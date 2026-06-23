// poll-product worker — Amazon'dan fiyat + stok çek, eBay fiyat/stok güncelle.
// Hem normal tarama hem AUTO-RECOVERY (duraklatılmış ürünü tekrar açma) bu worker'da.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct, ScraperOutOfCreditsError } from "@/lib/scraper";
import { calculateEbayPriceForMarket, isPriceSpike, determineQty } from "@/lib/repricer";
import { notifyScraperOutOfCredits } from "@/lib/admin-notify";
import { updateListingQueue, publishListingQueue, type PollProductJobData } from "@/lib/queues";

// ─── Aktif listing'leri duraklat + eBay'e qty 0 GÖNDER (oversell koruması) ──────
// Sadece DB'yi değil eBay'i de güncellemek şart; yoksa eBay'de satılabilir kalır.
async function pauseAllListings(productId: string): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: { productId, status: "active" },
    select: { id: true, currentPrice: true, ebayListingId: true },
  });
  await prisma.listing.updateMany({
    where: { productId, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });
  // eBay'de yayında olanları gerçekten duraklat (qty 0 → pauseListing)
  await Promise.all(
    listings
      .filter((l) => l.ebayListingId)
      .map((l) =>
        updateListingQueue.add(
          "update-listing",
          { listingId: l.id, price: l.currentPrice ?? 0, qty: 0 },
          { jobId: `update-listing:${l.id}:${Date.now()}` }
        )
      )
  );
}

// ─── Job işleyici ─────────────────────────────────────────────────────────────
async function processPollProduct(job: Job<PollProductJobData>): Promise<void> {
  const { productId, recovery = false } = job.data;

  // 1. Ürünü + TÜM listing'leri (aktif + duraklatılmış) çek
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      listings: {
        select: {
          id: true,
          ebaySite: true,
          marginPct: true,
          ebayAccountId: true,
          ebayListingId: true,
          status: true,
          lastEbayError: true,
          ebayAccount: { select: { isActive: true } },
          user: { select: { uploadProfitMarginPct: true } },
        },
      },
    },
  });

  if (!product) throw new Error(`Product bulunamadı: ${productId}`);
  if (!product.asin) {
    job.log(`ASIN yok — atlanıyor: ${productId}`);
    return;
  }
  // Duraklatılmış ürün: yalnız recovery modunda işlenir; manuel duraklatma asla oto-açılmaz
  if (product.status === "paused" && !recovery) {
    job.log(`Ürün duraklatılmış (recovery değil) — atlanıyor: ${productId}`);
    return;
  }
  if (product.status === "paused" && product.pauseReason === "manual") {
    job.log(`Manuel duraklatma — oto-recovery yapılmaz: ${productId}`);
    return;
  }

  const now = new Date();

  // 2. Amazon verisini çek — hata yönetimi (kota → admin bildirimi, sayaç artır, retry)
  let scraped;
  try {
    scraped = await fetchAmazonProduct(product.asin, product.amazonMarket ?? "US");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.product.update({
      where: { id: productId },
      data: { scrapeFailCount: { increment: 1 }, lastScrapeError: msg.slice(0, 300) },
    });
    if (err instanceof ScraperOutOfCreditsError) {
      await notifyScraperOutOfCredits(msg.slice(0, 120)).catch(() => {});
    }
    throw err; // BullMQ retry etsin; sürekli fail → watchdog duraklatır
  }

  const newAmazonPrice = scraped.price; // null olabilir (out/unknown)
  const { stockStatus, stockQty } = scraped;

  // 3. Stok → adet + duraklatma sebebi
  let newQty = determineQty(stockStatus, stockQty);
  let newPollTier = product.pollTier;
  if (stockStatus === "low" && newQty === 1) newPollTier = "hot";

  let pauseReason: string | null = null;
  if (newQty === 0) {
    pauseReason = stockStatus === "low" ? "low_stock" : "out_of_stock";
  }

  // 4. Fiyat tabanlı kontroller (fiyat okunabildiyse)
  const ebaySite = product.listings[0]?.ebaySite ?? "EBAY_US";
  let newEbayPrice = product.calculatedEbayPrice;

  if (newAmazonPrice !== null && pauseReason === null) {
    const oldAmazonPrice = product.amazonPrice ?? newAmazonPrice;
    if (isPriceSpike(oldAmazonPrice, newAmazonPrice)) {
      // Aşırı zıplama freni — duraklat (sonraki tarama doğrularsa recovery geri açar)
      pauseReason = "price_spike";
      newQty = 0;
    } else {
      const calc = await calculateEbayPriceForMarket(
        newAmazonPrice,
        product.amazonMarket ?? "US",
        ebaySite,
        product.ebayFeeRate,
        product.targetMargin
      );
      newEbayPrice = calc.ebayPrice;
      if (product.floorPrice !== null && newEbayPrice < product.floorPrice) {
        pauseReason = "floor";
        newQty = 0;
      }
    }
  }

  const shouldPause = newQty === 0 || pauseReason !== null;

  // 5. Ürünü güncelle (başarılı tarama → fail sayacı sıfırlanır)
  await prisma.product.update({
    where: { id: productId },
    data: {
      amazonPrice: newAmazonPrice ?? product.amazonPrice,
      amazonStockStatus: stockStatus,
      amazonStockQty: stockQty,
      calculatedEbayPrice: newEbayPrice,
      pollTier: newPollTier,
      lastScrapedAt: now,
      scrapeFailCount: 0,
      lastScrapeError: null,
      status: shouldPause ? "paused" : "active",
      pauseReason: shouldPause ? pauseReason : null,
      ...(scraped.title ? { title: scraped.title } : {}),
    },
  });

  if (shouldPause) {
    job.log(`Duraklatıldı (${pauseReason}) stok=${stockStatus}(${stockQty ?? "∞"}): ${product.asin}`);
    await pauseAllListings(productId);
    return;
  }

  // 6. Uygun listing'leri güncelle/yayınla/REAKTİVE et.
  //    Uygun = aktif VEYA (stok kaynaklı duraklatılmış: eBay hatası yok + mağaza aktif).
  const eligible = product.listings.filter(
    (l) =>
      l.status === "active" ||
      (l.status === "paused" && !l.lastEbayError && l.ebayAccount?.isActive === true)
  );

  if (eligible.length === 0) {
    job.log(`Uygun listing yok: ${productId}`);
    return;
  }

  let publishCount = 0;
  let updateCount = 0;
  let reactivateCount = 0;

  await Promise.all(
    eligible.map(async (listing) => {
      const marginPct = listing.marginPct ?? listing.user?.uploadProfitMarginPct;
      const margin = marginPct != null && marginPct > 0 ? marginPct / 100 : product.targetMargin;

      const { ebayPrice } = await calculateEbayPriceForMarket(
        newAmazonPrice ?? product.amazonPrice ?? 0,
        product.amazonMarket ?? "US",
        listing.ebaySite ?? "EBAY_US",
        product.ebayFeeRate,
        margin
      );

      const wasPaused = listing.status === "paused";
      if (wasPaused) reactivateCount++;

      // Fiyat/stok + status'u DB'ye yaz (paused→active reaktivasyon dahil)
      await prisma.listing.update({
        where: { id: listing.id },
        data: { currentPrice: ebayPrice, currentQty: newQty, status: "active" },
      });

      if (!listing.ebayListingId) {
        publishCount++;
        return publishListingQueue.add(
          "publish-listing",
          { listingId: listing.id, ebayAccountId: listing.ebayAccountId },
          { jobId: `publish-listing:${listing.id}:${Date.now()}` }
        );
      }
      updateCount++;
      return updateListingQueue.add(
        "update-listing",
        { listingId: listing.id, price: ebayPrice, qty: newQty },
        { jobId: `update-listing:${listing.id}:${Date.now()}` }
      );
    })
  );

  job.log(
    `Tamamlandı${recovery ? " (RECOVERY)" : ""}: ${product.asin} | eBay: $${newEbayPrice?.toFixed(2) ?? "?"} | stok: ${stockStatus}(${stockQty ?? "∞"}) | yayınla=${publishCount} güncelle=${updateCount} reaktive=${reactivateCount}`
  );
}

// ─── Worker factory ────────────────────────────────────────────────────────────
export function createPollProductWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<PollProductJobData>("poll-product", processPollProduct, {
    connection,
    concurrency: 4,
  });

  worker.on("completed", (job) => {
    console.log(`[poll-product] ✓ ${job.id} | productId: ${job.data.productId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[poll-product] ✗ ${job?.id} | productId: ${job?.data.productId} | ${err.message}`);
  });
  worker.on("error", (err) => {
    console.error(`[poll-product] Worker hatası:`, err);
  });

  return worker;
}
