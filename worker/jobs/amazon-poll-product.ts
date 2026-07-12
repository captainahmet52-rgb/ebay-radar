// AmazonBot stok/fiyat tarama — depo ürününü AliExpress'ten tazeler, listeleri günceller.
// Sadece YÜKLENMİŞ (listing'i olan) ürünler taranır. AliExpress kaynağı API gelince aktif.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAliExpressProduct } from "@/lib/aliexpress";
import { isSignificantChange } from "@/lib/repricer";
import {
  AMAZON_MARKETS,
  getReferralRate,
  resolveMargin,
  userMarginForMarket,
  calculateAmazonPrice,
  determineAmazonQty,
  isPriceSpike,
} from "@/lib/amazon-repricer";
import { amazonUpdateListingQueue } from "@/lib/queues";
import type { AmazonPollProductJobData } from "@/lib/queues";

// ─── Aktif listing'leri duraklat + Amazon'a qty 0 GÖNDER (oversell koruması) ────
// Sadece DB'yi değil Amazon'u da güncellemek şart; yoksa Amazon'da satılabilir kalır.
// SIRA KRİTİK: ÖNCE Amazon qty-0 işini (Redis'te kalıcı) kuyruğa at, SONRA DB'yi
// paused yap — eBay'deki pauseAllListings ile birebir aynı sıra mantığı.
async function pauseAllListings(depotProductId: string): Promise<void> {
  const listings = await prisma.amazonListing.findMany({
    where: { productId: depotProductId, status: "active" },
    select: { id: true, salePrice: true },
  });
  await Promise.all(
    listings.map((l) =>
      amazonUpdateListingQueue.add(
        "amazon-update-listing",
        { listingId: l.id, price: l.salePrice ?? 0, qty: 0 },
        { jobId: `pause-amazon-listing:${l.id}` }
      )
    )
  );
  await prisma.amazonListing.updateMany({
    where: { productId: depotProductId, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });
}

async function processAmazonPollProduct(job: Job<AmazonPollProductJobData>): Promise<void> {
  const { depotProductId } = job.data;

  const product = await prisma.amazonDepotProduct.findUnique({
    where: { id: depotProductId },
    include: {
      // Uygun = aktif VEYA (stok kaynaklı duraklatılmış: hata yok + hesabı aktif) — eBay'deki eligible ile aynı.
      listings: {
        where: {
          OR: [
            { status: "active" },
            { status: "paused", lastError: null, amazonAccount: { isActive: true } },
          ],
        },
        include: {
          user: {
            select: {
              amazonMarginUsPct: true, amazonMarginUkPct: true,
              amazonMarginAePct: true, amazonMarginSaPct: true,
            },
          },
        },
      },
    },
  });

  if (!product || product.status === "paused") return;

  // 1. AliExpress'ten taze veri (API yoksa job fail olur — beklenen)
  const ali = await fetchAliExpressProduct(product.aliId);

  const oldCost = product.aliCostUsd;
  const newCost = ali.costUsd;

  // 2. Spike freni — %50'den fazla artış → duraklat
  if (isPriceSpike(oldCost, newCost)) {
    await pauseAllListings(depotProductId);
    await prisma.amazonDepotProduct.update({
      where: { id: depotProductId },
      data: {
        aliCostUsd: newCost, aliShippingUsd: ali.shippingUsd,
        aliStockStatus: ali.stockStatus, aliStockQty: ali.stockQty,
        lastScrapedAt: new Date(), status: "paused",
      },
    });
    await job.log(`Spike — duraklatıldı: ${product.aliId}`);
    return;
  }

  // 3. Stok → qty
  const newQty = determineAmazonQty(ali.stockStatus, ali.stockQty);
  const shouldPause = newQty === 0;

  await prisma.amazonDepotProduct.update({
    where: { id: depotProductId },
    data: {
      aliCostUsd: newCost, aliShippingUsd: ali.shippingUsd,
      aliStockStatus: ali.stockStatus, aliStockQty: ali.stockQty,
      pollTier: ali.stockStatus === "low" ? "hot" : product.pollTier,
      lastScrapedAt: new Date(),
      status: shouldPause ? "paused" : "active",
      ...(ali.title ? { title: ali.title } : {}),
    },
  });

  if (shouldPause) {
    await pauseAllListings(depotProductId);
    await job.log(`Stok yetersiz (${ali.stockStatus}) — duraklatıldı: ${product.aliId}`);
    // Depo doldurma artık Radar projesinin zamanlanmış taramasında (yerel tetikleme yok).
    return;
  }

  // 4. Her listing'i KENDİ kullanıcısının pazar marjıyla yeniden fiyatla + Amazon'a it
  const referralRate = getReferralRate(product.category);
  let updateCount = 0;
  let reactivateCount = 0;
  let skipCount = 0;

  for (const listing of product.listings) {
    const marketCfg = AMAZON_MARKETS[listing.market];
    if (!marketCfg) continue;
    const margin = resolveMargin(marketCfg, userMarginForMarket(listing.market, listing.user));
    const pricing = calculateAmazonPrice(newCost, ali.shippingUsd, referralRate, marketCfg, margin);

    const wasPaused = listing.status === "paused";
    if (wasPaused) reactivateCount++;

    await prisma.amazonListing.update({
      where: { id: listing.id },
      data: { salePrice: pricing.salePrice, currentQty: newQty, status: "active" },
    });

    // HİSTEREZİS: reaktivasyon/stok değişimi yoksa ve fiyat farkı önemsizse Amazon'a
    // dokunma (gereksiz SP-API trafiği + fiyat flapping önlenir) — eBay ile aynı desen.
    const priceChanged = isSignificantChange(listing.salePrice, pricing.salePrice);
    const qtyChanged = listing.currentQty !== newQty;
    if (!wasPaused && !priceChanged && !qtyChanged) {
      skipCount++;
      continue;
    }

    updateCount++;
    await amazonUpdateListingQueue.add(
      "amazon-update-listing",
      { listingId: listing.id, price: pricing.salePrice, qty: newQty },
      { jobId: `amazon-update-listing:${listing.id}:${Date.now()}` }
    );
  }

  await job.log(
    `Tamam: ${product.aliId} | güncelle=${updateCount} reaktive=${reactivateCount} atlanan(histerezis)=${skipCount}`
  );
}

export function createAmazonPollProductWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonPollProductJobData>(
    "amazon-poll-product",
    processAmazonPollProduct,
    { connection, concurrency: 4 }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-poll-product] ✓ ${job.id} | ${job.data.depotProductId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-poll-product] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-poll-product] worker hatası:", err));

  return worker;
}
