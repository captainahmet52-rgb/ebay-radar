// Radar worker — eBay mağazasını tara, Amazon'da ara, depoya yükle
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchEbayStoreListing } from "@/lib/ebay-store-scraper";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { selectRadarMatch, GLOBAL_PRECISION_BAND } from "@/lib/radar/source-matcher";
import { refineWithImageEvidence } from "@/lib/radar/image-evidence";
import { makeUrlComparator } from "@/lib/radar/image-compare";
import { loadGrayscaleFromUrl } from "@/lib/radar/image-fetch";
import { getRadarRedis } from "@/lib/radar/redis-client";
import { getSellerPriceBand, recordSellerRatio } from "@/lib/radar/seller-profile";
import { recordRadarDecision } from "@/lib/radar/audit";
import { assessViability } from "@/lib/radar/viability";
import type { RadarScanJobData } from "@/lib/queues";

// Görsel karşılaştırıcı (gerçek indir+decode). accept/review kararlarında devreye girer.
const imageComparator = makeUrlComparator(loadGrayscaleFromUrl);

// Matcher'a kaç aday verilecek (maliyet yok — sadece CPU; çok aday = daha iyi seçim)
const MAX_CANDIDATES = 12;
// $15 altı asla alınma (CLAUDE.md) — fiyat bandının yanında ek sert taban
const MIN_AMAZON_PRICE = 15;

async function processRadarScan(job: Job<RadarScanJobData>): Promise<void> {
  const { trackedStoreId } = job.data;

  const store = await prisma.trackedStore.findUnique({
    where: { id: trackedStoreId },
  });

  if (!store || !store.isActive) {
    await job.log(`Mağaza bulunamadı veya pasif: ${trackedStoreId}`);
    return;
  }

  await job.log(`Mağaza taranıyor: ${store.ebayUsername}`);

  // 1. eBay mağazasından ürün listesini çek (ilk 2 sayfa)
  let storeItems: Awaited<ReturnType<typeof fetchEbayStoreListing>> = [];
  for (let page = 1; page <= 2; page++) {
    try {
      const items = await fetchEbayStoreListing(store.ebayUsername, page);
      storeItems = storeItems.concat(items);
      if (items.length < 48) break; // Son sayfa
    } catch (err) {
      await job.log(`eBay scrape hata (sayfa ${page}): ${err}`);
      break;
    }
  }

  await job.log(`${storeItems.length} eBay ürünü bulundu`);

  // Satıcıya-özel hassas fiyat bandını TUR BAŞINA bir kez öğren (mağaza sabit).
  const redis = getRadarRedis();
  const sellerBand = redis
    ? await getSellerPriceBand(redis, store.id, GLOBAL_PRECISION_BAND)
    : GLOBAL_PRECISION_BAND;

  // 2. Her ürün başlığı için Amazon'da ara → ÇEKİMSER SEÇİCİ → en fazla TEK ASIN.
  //    "Kanıtla ya da atla": tek bir yanlış ASIN müşterinin gerçek mağazasına
  //    listelenir → yanlış kargo → ban. Kanıt yoksa hiç ekleme.
  let acceptedCount = 0;
  let reviewCount = 0;
  let skippedCount = 0;
  let dedupCount = 0;
  let uncompetitiveCount = 0;

  for (const item of storeItems.slice(0, 50)) { // ilk 50 ürün
    if (!item.title || item.title.length < 5) continue;

    try {
      // Amazon'da ara — sadece ilk sayfa
      const amazonResults = await searchAmazonProducts(item.title, 1);

      // $15 sert taban — bant öncesi ele
      const candidates = amazonResults
        .filter((r) => r.price === null || r.price >= MIN_AMAZON_PRICE)
        .slice(0, MAX_CANDIDATES);

      if (candidates.length === 0) { skippedCount++; continue; }

      const sourceItem = { title: item.title, price: item.price, imageUrl: item.imageUrl };
      let match = selectRadarMatch(
        sourceItem,
        candidates.map((c) => ({
          asin: c.asin,
          title: c.title,
          price: c.price,
          imageUrl: c.imageUrl,
        })),
        { precisionBand: sellerBand },
      );

      // Görsel kanıt katmanı — yalnız accept (savunma) ve review (yükseltme) için.
      // skip'te görsel indirmeyiz (çöp adaylar için bant genişliği israfı olmasın).
      if (match.decision === "accept" || match.decision === "review") {
        try {
          match = await refineWithImageEvidence(sourceItem, match, imageComparator);
        } catch {
          /* görsel hatası → metin kararı korunur */
        }
      }

      // PARA MOTORU (P5) — rekabetçilik + talep + kâr projeksiyonu.
      const viability = assessViability({
        amazonPrice: match.candidate?.price ?? null,
        competitorPrice: item.price,
        soldCount: item.soldCount,
      });

      // accept ama rakipten aşırı pahalı (satmaz) → etkili karar SKIP'e iner.
      const blockedByViability = match.decision === "accept" && !viability.viable;
      const effectiveDecision = blockedByViability ? "skip" : match.decision;

      const priceRatio =
        item.price && item.price > 0 && match.candidate?.price
          ? match.candidate.price / item.price
          : null;
      if (redis) {
        await recordRadarDecision(redis, {
          ts: Date.now(),
          storeId: store.id,
          ebayTitle: item.title.slice(0, 120),
          ebayPrice: item.price,
          decision: effectiveDecision,
          asin: match.candidate?.asin ?? null,
          contract: match.contract,
          confidence: match.confidence,
          reason: blockedByViability ? viability.reason : match.reason,
          priceRatio,
          candidateCount: candidates.length,
          soldCount: item.soldCount,
          competitiveness: viability.competitiveness,
          rankScore: viability.rankScore,
        });
      }

      if (effectiveDecision === "skip" || !match.candidate) {
        if (blockedByViability) {
          uncompetitiveCount++;
          await job.log(`[skip:viability] ${match.candidate?.asin} ← "${item.title.slice(0, 50)}" (${viability.reason})`);
        } else {
          skippedCount++;
        }
        continue;
      }

      // Depoda zaten var mı? (ASIN unique) — varsa atla
      const exists = await prisma.depotProduct.findUnique({
        where: { asin: match.candidate.asin },
        select: { id: true },
      });
      if (exists) { dedupCount++; continue; }

      // accept → status "active" (dağıtılır) | review → "review" (insan incelemesi, dağıtılmaz)
      const depotStatus = effectiveDecision === "accept" ? "active" : "review";

      await prisma.depotProduct.create({
        data: {
          asin: match.candidate.asin,
          title: match.candidate.title || null,
          imageUrl: match.candidate.imageUrl || null,
          amazonPrice: match.candidate.price,
          calculatedEbayPrice: viability.projectedEbayPrice,
          soldCount: item.soldCount,
          competitorPrice: item.price,
          projectedProfit: viability.projectedProfit,
          projectedMarginPct: viability.projectedMarginPct,
          rankScore: viability.rankScore,
          sourceStoreId: store.id,
          sourceKeyword: item.title,
          status: depotStatus,
        },
      });

      if (effectiveDecision === "accept") {
        acceptedCount++;
        // Satıcı marj profilini öğret (yalnız kesin kabul + bilinen oran).
        if (redis && priceRatio !== null) {
          await recordSellerRatio(redis, store.id, priceRatio);
        }
      } else {
        reviewCount++;
      }

      await job.log(
        `[${effectiveDecision}] ${match.candidate.asin} ← "${item.title.slice(0, 50)}" ` +
        `(${match.contract ? "sözleşme " + match.contract : match.reason}, ${viability.reason})`,
      );
    } catch (err) {
      await job.log(`Amazon arama hata (${item.title}): ${err}`);
    }
  }

  // 3. Mağazanın son tarama zamanını güncelle
  await prisma.trackedStore.update({
    where: { id: trackedStoreId },
    data: { lastScannedAt: new Date() },
  });

  await job.log(
    `Tamamlandı: ${acceptedCount} kabul, ${reviewCount} inceleme, ` +
    `${skippedCount} atlandı, ${uncompetitiveCount} rekabetçi değil, ${dedupCount} zaten depoda`,
  );
}

export function createRadarScanWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<RadarScanJobData>("radar-scan", processRadarScan, {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 1000 },
  });

  worker.on("completed", job => {
    console.log(`[radar-scan] ✓ ${job.id} | store: ${job.data.trackedStoreId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[radar-scan] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", err => console.error("[radar-scan] worker hatası:", err));

  return worker;
}
