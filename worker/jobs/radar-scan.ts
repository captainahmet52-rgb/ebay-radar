// Radar worker — eBay mağazasını tara, Amazon'da ara, depoya yükle
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchEbayStoreListing } from "@/lib/ebay-store-scraper";
import { searchAmazonProducts } from "@/lib/amazon-search-scraper";
import type { RadarScanJobData } from "@/lib/queues";

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

  // 2. Her ürün başlığı için Amazon'da ara, ASIN'leri depoya yükle
  let addedCount = 0;
  let skippedCount = 0;

  for (const item of storeItems.slice(0, 50)) { // ilk 50 ürün
    if (!item.title || item.title.length < 5) continue;

    try {
      // Amazon'da ara — sadece ilk sayfa
      const amazonResults = await searchAmazonProducts(item.title, 1);

      for (const result of amazonResults.slice(0, 5)) { // her başlık için max 5 ASIN
        // Zaten depoda varsa atla
        const existing = await prisma.depotProduct.findUnique({
          where: { asin: result.asin },
        });
        if (existing) { skippedCount++; continue; }

        // Minimum fiyat kontrolü: $15 altı alma (CLAUDE.md)
        if (result.price !== null && result.price < 15) continue;

        await prisma.depotProduct.create({
          data: {
            asin: result.asin,
            title: result.title || null,
            imageUrl: result.imageUrl || null,
            amazonPrice: result.price,
            sourceStoreId: store.id,
            sourceKeyword: item.title,
            status: "active",
          },
        });
        addedCount++;
      }
    } catch (err) {
      await job.log(`Amazon arama hata (${item.title}): ${err}`);
    }
  }

  // 3. Mağazanın son tarama zamanını güncelle
  await prisma.trackedStore.update({
    where: { id: trackedStoreId },
    data: { lastScannedAt: new Date() },
  });

  await job.log(`Tamamlandı: ${addedCount} yeni ASIN eklendi, ${skippedCount} atlandı`);
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
