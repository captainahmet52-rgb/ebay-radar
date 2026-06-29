// Radar worker — eBay mağazasını tara, Amazon'da ara, depoya yükle
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchEbayStoreListing } from "@/lib/ebay-store-scraper";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import { selectRadarMatch } from "@/lib/radar/source-matcher";
import { refineWithImageEvidence } from "@/lib/radar/image-evidence";
import { makeUrlComparator } from "@/lib/radar/image-compare";
import { loadGrayscaleFromUrl } from "@/lib/radar/image-fetch";
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

  // 2. Her ürün başlığı için Amazon'da ara → ÇEKİMSER SEÇİCİ → en fazla TEK ASIN.
  //    "Kanıtla ya da atla": tek bir yanlış ASIN müşterinin gerçek mağazasına
  //    listelenir → yanlış kargo → ban. Kanıt yoksa hiç ekleme.
  let acceptedCount = 0;
  let reviewCount = 0;
  let skippedCount = 0;
  let dedupCount = 0;

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

      if (match.decision === "skip" || !match.candidate) {
        skippedCount++;
        continue;
      }

      // Depoda zaten var mı? (ASIN unique) — varsa atla
      const exists = await prisma.depotProduct.findUnique({
        where: { asin: match.candidate.asin },
        select: { id: true },
      });
      if (exists) { dedupCount++; continue; }

      // accept → status "active" (dağıtılır) | review → "review" (insan incelemesi, dağıtılmaz)
      const depotStatus = match.decision === "accept" ? "active" : "review";

      await prisma.depotProduct.create({
        data: {
          asin: match.candidate.asin,
          title: match.candidate.title || null,
          imageUrl: match.candidate.imageUrl || null,
          amazonPrice: match.candidate.price,
          sourceStoreId: store.id,
          sourceKeyword: item.title,
          status: depotStatus,
        },
      });

      if (match.decision === "accept") acceptedCount++;
      else reviewCount++;

      await job.log(
        `[${match.decision}] ${match.candidate.asin} ← "${item.title.slice(0, 50)}" ` +
        `(${match.contract ? "sözleşme " + match.contract : match.reason}, güven ${match.confidence.toFixed(2)})`,
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
    `${skippedCount} atlandı, ${dedupCount} zaten depoda`,
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
