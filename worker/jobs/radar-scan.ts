// Radar worker — eBay mağazasını tara, Amazon'da ara, depoya yükle
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchSellerListings } from "@/lib/ebay/seller-listings";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { selectRadarMatch, GLOBAL_PRECISION_BAND } from "@/lib/radar/source-matcher";
import { refineWithImageEvidence } from "@/lib/radar/image-evidence";
import { makeUrlComparator } from "@/lib/radar/image-compare";
import { loadGrayscaleFromUrl } from "@/lib/radar/image-fetch";
import { getRadarRedis } from "@/lib/radar/redis-client";
import { getSellerPriceBand, recordSellerRatio } from "@/lib/radar/seller-profile";
import { recordRadarDecision } from "@/lib/radar/audit";
import { assessViability } from "@/lib/radar/viability";
import { buildAmazonQueries } from "@/lib/radar/query-builder";
import { wasRecentlySeen, markSeen } from "@/lib/radar/item-cache";
import type { RadarScanJobData } from "@/lib/queues";

// Görsel karşılaştırıcı (gerçek indir+decode). accept/review kararlarında devreye girer.
const imageComparator = makeUrlComparator(loadGrayscaleFromUrl);

// Matcher'a verilecek azami aday (CPU only; çok-sorgu havuzu için biraz geniş)
const MAX_CANDIDATES = 20;
// $15 altı asla alınma (CLAUDE.md) — fiyat bandının yanında ek sert taban
const MIN_AMAZON_PRICE = 15;
// Çok-sorgulu arama: en fazla bu kadar Amazon sorgusu dene, accept bulununca DUR.
const MAX_QUERIES = 3;
// eBay tarafından TÜM mağaza kataloğunu çek (Browse BEDAVA → tümünü al, kapsama için).
const MAX_STORE_FETCH = 1000;
// Amazon eşleştirmesi ScrapingBee kredisi yakar → tur başına bu kadar YENİ ürün işle.
// Cache sayesinde her tarama katalogda İLERLER (tur1: 1-80, tur2: 81-160 ...) →
// birkaç turda tüm mağaza taranır. Sayıyı artırmak = tur başına daha çok kredi.
const MAX_ITEMS_PER_SCAN = 80;

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
  await job.updateProgress({ phase: "fetching", processed: 0, total: 0 });

  // 1. Satıcının ilanlarını RESMİ Browse API ile çek (BEDAVA — ScrapingBee YOK).
  //    store.ebayUsername = GERÇEK eBay satıcı kullanıcı adı (örn. "md.asifpa-0"),
  //    mağaza URL slug'ı DEĞİL — mağaza eklenirken ürün linkinden çözülür.
  let storeItems: Awaited<ReturnType<typeof fetchSellerListings>> = [];
  try {
    storeItems = await fetchSellerListings(store.ebayUsername, MAX_STORE_FETCH);
  } catch (err) {
    await job.log(`eBay Browse API hata: ${err}`);
  }

  await job.log(`${storeItems.length} eBay ürünü bulundu (Browse API — tüm katalog)`);

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
  let cachedCount = 0;
  let processedItems = 0;

  // KAPSAMA: tüm katalogtan HENÜZ değerlendirilmemiş (cache'te olmayan) ürünleri süz,
  // bu turda sadece ilk MAX_ITEMS_PER_SCAN'ini işle. Böylece her tarama katalogda
  // İLERLER (tur1: 1-80, tur2: 81-160 ...) → birkaç turda TÜM mağaza taranır.
  // cachedCount = önceki turlarda kapsanan ürün sayısı (ilerleme göstergesi).
  const pending: typeof storeItems = [];
  for (const item of storeItems) {
    if (!item.title || item.title.length < 5) continue;
    if (item.itemId && redis && (await wasRecentlySeen(redis, item.itemId))) {
      cachedCount++;
      continue;
    }
    if (pending.length < MAX_ITEMS_PER_SCAN) pending.push(item);
  }

  await job.log(
    `Bu turda ${pending.length} YENİ ürün işlenecek ` +
    `(${cachedCount} zaten kapsandı, toplam katalog ${storeItems.length})`,
  );

  const totalToProcess = pending.length;
  await job.updateProgress({
    phase: "matching", processed: 0, total: totalToProcess,
    accepted: 0, review: 0, skipped: 0, cached: cachedCount,
  });

  for (const item of pending) {
    processedItems++;
    await job.updateProgress({
      phase: "matching",
      processed: processedItems,
      total: totalToProcess,
      accepted: acceptedCount,
      review: reviewCount,
      skipped: skippedCount + uncompetitiveCount,
      cached: cachedCount,
    });

    try {
      const sourceItem = { title: item.title, price: item.price, imageUrl: item.imageUrl };

      // ÇOK-SORGULU ARAMA: sorguları sırayla dene, aday havuzunu birleştir, accept
      // bulununca DUR (kolay item'da 1 kredi; sadece zor item'da ek sorgu).
      const queries = buildAmazonQueries(item.title);
      const seenAsin = new Set<string>();
      const pool: { asin: string; title: string; price: number | null; imageUrl: string | null }[] = [];
      let match: ReturnType<typeof selectRadarMatch> | null = null;

      for (let qi = 0; qi < queries.length && qi < MAX_QUERIES; qi++) {
        const res = await searchAmazonProducts(queries[qi], 1);
        for (const r of res) {
          if (r.price !== null && r.price < MIN_AMAZON_PRICE) continue;
          if (seenAsin.has(r.asin)) continue;
          seenAsin.add(r.asin);
          pool.push({ asin: r.asin, title: r.title, price: r.price, imageUrl: r.imageUrl });
        }
        if (pool.length === 0) continue;
        match = selectRadarMatch(sourceItem, pool.slice(0, MAX_CANDIDATES), { precisionBand: sellerBand });
        if (match.decision === "accept") break; // güçlü eşleşme → ek sorgu yapma
      }

      const candidates = pool;
      if (!match || candidates.length === 0) {
        skippedCount++;
        if (item.itemId && redis) await markSeen(redis, item.itemId, "skip");
        continue;
      }

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
        if (item.itemId && redis) await markSeen(redis, item.itemId, effectiveDecision);
        continue;
      }

      // Depoda zaten var mı? (ASIN unique) — varsa atla
      const exists = await prisma.depotProduct.findUnique({
        where: { asin: match.candidate.asin },
        select: { id: true },
      });
      if (exists) {
        dedupCount++;
        if (item.itemId && redis) await markSeen(redis, item.itemId, "dedup");
        continue;
      }

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
      if (item.itemId && redis) await markSeen(redis, item.itemId, effectiveDecision);

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

  await job.updateProgress({
    phase: "done",
    processed: totalToProcess,
    total: totalToProcess,
    accepted: acceptedCount,
    review: reviewCount,
    skipped: skippedCount,
    uncompetitive: uncompetitiveCount,
    dedup: dedupCount,
    cached: cachedCount,
  });

  await job.log(
    `Tamamlandı: ${acceptedCount} kabul, ${reviewCount} inceleme, ` +
    `${skippedCount} atlandı, ${uncompetitiveCount} rekabetçi değil, ${dedupCount} zaten depoda, ` +
    `${cachedCount} cache (Amazon araması yapılmadı)`,
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
