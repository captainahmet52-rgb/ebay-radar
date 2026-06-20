// poll-product worker — Amazon'dan fiyat + stok çek, eBay fiyatını güncelle
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct } from "@/lib/scraper";
import { calculateEbayPriceForMarket, isPriceSpike } from "@/lib/repricer";
import { updateListingQueue, type PollProductJobData } from "@/lib/queues";

// ─── Kuyruktaki tüm aktif listing'leri duraklat ────────────────────────────────
async function pauseAllListings(productId: string): Promise<void> {
  await prisma.listing.updateMany({
    where: { productId, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });
}

// ─── Job işleyici ─────────────────────────────────────────────────────────────
async function processPollProduct(
  job: Job<PollProductJobData>
): Promise<void> {
  const { productId } = job.data;

  // 1. Ürünü DB'den çek
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      listings: {
        where: { status: "active" },
        select: {
          id: true,
          ebaySite: true,
          marginPct: true,
          user: { select: { uploadProfitMarginPct: true } },
        },
      },
    },
  });

  if (!product) {
    throw new Error(`Product bulunamadı: ${productId}`);
  }

  if (product.status === "paused" || !product.asin) {
    job.log(`Ürün durumu ${product.status} — atlanıyor: ${productId}`);
    return;
  }

  // 2. ScrapingBee ile Amazon verisini çek
  const market = (product.amazonMarket ?? "US") as "US" | "UK";
  const scraped = await fetchAmazonProduct(product.asin, market);

  if (scraped.price === null) {
    throw new Error(
      `Amazon fiyatı parse edilemedi: ${product.asin} (null döndü)`
    );
  }

  const newAmazonPrice = scraped.price;
  const oldAmazonPrice = product.amazonPrice ?? newAmazonPrice;

  // 3. %50'den fazla fiyat artışı kontrolü — "aşırı zıplama freni"
  if (isPriceSpike(oldAmazonPrice, newAmazonPrice)) {
    job.log(
      `UYARI: Fiyat spike tespit edildi — ürün duraklatıldı: ${product.asin}`
    );

    await prisma.product.update({
      where: { id: productId },
      data: {
        amazonPrice: newAmazonPrice,
        amazonStockStatus: scraped.stockStatus,
        amazonStockQty: scraped.stockQty,
        lastScrapedAt: new Date(),
        status: "paused",
      },
    });

    await pauseAllListings(productId);
    return;
  }

  // 4. Yeni eBay fiyatı hesapla (marketplace'e göre kur dönüşümü dahil)
  const ebaySite = product.listings[0]?.ebaySite ?? "EBAY_US";
  const { ebayPrice: newEbayPrice } = await calculateEbayPriceForMarket(
    newAmazonPrice,
    product.amazonMarket ?? "US",
    ebaySite,
    product.ebayFeeRate,
    product.targetMargin
  );

  // Floor price kontrolü
  if (product.floorPrice !== null && newEbayPrice < product.floorPrice) {
    job.log(
      `Hesaplanan eBay fiyatı (${newEbayPrice.toFixed(2)}) taban fiyatın (${product.floorPrice}) altında — duraklatılıyor`
    );
    await prisma.product.update({
      where: { id: productId },
      data: {
        amazonPrice: newAmazonPrice,
        amazonStockStatus: scraped.stockStatus,
        amazonStockQty: scraped.stockQty,
        calculatedEbayPrice: newEbayPrice,
        lastScrapedAt: new Date(),
        status: "paused",
      },
    });
    await pauseAllListings(productId);
    return;
  }

  // 5. Stok durumuna göre qty ve pollTier hesapla
  const { stockStatus, stockQty } = scraped;
  let newQty: number;
  let newPollTier: string = product.pollTier;
  let productShouldPause = false;

  if (stockStatus === "out") {
    // Tükenmiş → duraklat
    newQty = 0;
    productShouldPause = true;
  } else if (stockStatus === "low") {
    const qty = stockQty ?? 1;
    if (qty < 3) {
      // Kritik az stok → duraklat
      newQty = 0;
      productShouldPause = true;
    } else {
      // Az stok ama yeterli → qty=1, sıcak gruba al
      newQty = 1;
      newPollTier = "hot";
    }
  } else {
    // in_stock → qty=2
    newQty = 2;
    // Eğer önceki tier hot'sa ve artık in_stock'sa normal'a dönebilir
    // (iş kuralı: sadece stok azalınca hot'a taşınır, artınca kullanıcı kararı verebilir;
    //  şimdilik hot'ta kalır — monitoring için sorun yok)
  }

  // 6. DB güncelle
  const newProductStatus = productShouldPause ? "paused" : "active";

  await prisma.product.update({
    where: { id: productId },
    data: {
      amazonPrice: newAmazonPrice,
      amazonStockStatus: stockStatus,
      amazonStockQty: stockQty,
      calculatedEbayPrice: newEbayPrice,
      pollTier: newPollTier,
      lastScrapedAt: new Date(),
      status: newProductStatus,
      // title güncelle (değişmişse)
      ...(scraped.title ? { title: scraped.title } : {}),
    },
  });

  if (productShouldPause) {
    job.log(
      `Stok durumu "${stockStatus}" (qty: ${stockQty}) — tüm listing'ler duraklatıldı: ${product.asin}`
    );
    await pauseAllListings(productId);
    return;
  }

  // 7. Her aktif listing için update-listing kuyruğuna ekle
  const activeListings = product.listings;

  if (activeListings.length === 0) {
    job.log(`Aktif listing yok — güncelleme kuyruğuna eklenmedi: ${productId}`);
    return;
  }

  // Her listing için marj: önce liste batch marjı, sonra kullanıcı marjı, sonra ürün varsayılanı
  await Promise.all(
    activeListings.map(async (listing) => {
      const marginPct = listing.marginPct ?? listing.user?.uploadProfitMarginPct;
      const margin =
        marginPct != null && marginPct > 0 ? marginPct / 100 : product.targetMargin;

      const { ebayPrice } = await calculateEbayPriceForMarket(
        newAmazonPrice,
        product.amazonMarket ?? "US",
        listing.ebaySite ?? "EBAY_US",
        product.ebayFeeRate,
        margin
      );

      return updateListingQueue.add(
        "update-listing",
        { listingId: listing.id, price: ebayPrice, qty: newQty },
        { jobId: `update-listing:${listing.id}:${Date.now()}` }
      );
    })
  );

  job.log(
    `Tamamlandı: ${product.asin} | Amazon: $${newAmazonPrice.toFixed(2)} → eBay: $${newEbayPrice.toFixed(2)} | Stok: ${stockStatus}(${stockQty ?? "∞"}) | ${activeListings.length} listing kuyruğa eklendi`
  );
}

// ─── Worker factory ────────────────────────────────────────────────────────────
export function createPollProductWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<PollProductJobData>(
    "poll-product",
    processPollProduct,
    {
      connection,
      concurrency: 4,
    }
  );

  worker.on("completed", (job) => {
    console.log(
      `[poll-product] ✓ Job tamamlandı: ${job.id} | productId: ${job.data.productId}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[poll-product] ✗ Job başarısız: ${job?.id} | productId: ${job?.data.productId} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error(`[poll-product] Worker hatası:`, err);
  });

  return worker;
}
