// poll-product worker — Amazon'dan fiyat + stok çek, eBay fiyat/stok güncelle.
// Hem normal tarama hem AUTO-RECOVERY (duraklatılmış ürünü tekrar açma) bu worker'da.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct, ScraperOutOfCreditsError } from "@/lib/scraper";
import { calculateEbayPriceForMarket, isPriceSpike, determineQty, isSignificantChange } from "@/lib/repricer";
import { revalidateListingTitle } from "@/lib/ebay/revalidate";
import { notifyScraperOutOfCredits } from "@/lib/admin-notify";
import { updateListingQueue, publishListingQueue, type PollProductJobData } from "@/lib/queues";

// ─── Aktif listing'leri duraklat + eBay'e qty 0 GÖNDER (oversell koruması) ──────
// Sadece DB'yi değil eBay'i de güncellemek şart; yoksa eBay'de satılabilir kalır.
// SIRA KRİTİK: ÖNCE eBay qty-0 işini (Redis'te kalıcı) kuyruğa at, SONRA DB'yi
// paused yap. Enqueue ile DB-update arasında çökersek DB "active" kalır →
// sonraki tarama idempotent şekilde tekrar pause eder (zararsız tekrar).
// Ters sırada (önce DB) çökersek DB "paused" der ama eBay'de ürün satılabilir
// kalır VE re-run status:active filtresine takılmaz = KALICI OVERSELL.
// jobId stable (Date.now() YOK) → tekrar enqueue idempotent, çift qty-0 olmaz.
async function pauseAllListings(productId: string): Promise<void> {
  const listings = await prisma.listing.findMany({
    where: { productId, status: "active" },
    select: { id: true, currentPrice: true, ebayListingId: true },
  });
  // 1) ÖNCE eBay'de yayında olanları qty 0'a çek (Redis'te kalıcı iş)
  await Promise.all(
    listings
      .filter((l) => l.ebayListingId)
      .map((l) =>
        updateListingQueue.add(
          "update-listing",
          { listingId: l.id, price: l.currentPrice ?? 0, qty: 0 },
          { jobId: `pause-listing:${l.id}` }
        )
      )
  );
  // 2) SONRA DB'yi paused yap
  await prisma.listing.updateMany({
    where: { productId, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });
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
          currentPrice: true,
          currentQty: true,
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

  // 2b. Spike DOĞRULAMA — tek bozuk taramadan boş yere duraklatma. Fiyat zıpladıysa
  //     bir kez daha çek; ikinci tarama gerçek veridir. (Tükendi'de doğrulama yok, hız önemli.)
  if (
    scraped.price !== null &&
    product.amazonPrice &&
    isPriceSpike(product.amazonPrice, scraped.price)
  ) {
    job.log(`Fiyat zıpladı ($${product.amazonPrice}→$${scraped.price}), doğrulanıyor: ${product.asin}`);
    try {
      scraped = await fetchAmazonProduct(product.asin, product.amazonMarket ?? "US");
    } catch {
      // Doğrulama çekilemezse ilk veriyle devam (güvenli taraf: spike → duraklat)
    }
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

  // 5. OVERSELL FRENİ — sıralama kritik: duraklatılacaksa ÖNCE eBay'i güvene al,
  //    SONRA DB'yi paused yap. pauseAllListings qty 0 işini BullMQ'ya (Redis'te
  //    kalıcı) koyar → süreç burada çökse bile eBay sonunda qty 0'a iner.
  //    Ters sırada (önce DB paused) çökersek DB "duraklatıldı" der ama eBay'de
  //    ürün satılabilir kalır = OVERSELL. Bu sırada (pauseAllListings sonrası,
  //    product.update öncesi) çökersek ürün "active" kalır ve sonraki tarama
  //    tekrar duraklatır (pauseAllListings idempotent, zararsız tekrar).
  if (shouldPause) {
    await pauseAllListings(productId);
  }

  // 6. Ürünü güncelle (başarılı tarama → fail sayacı sıfırlanır)
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

  // Stok/fiyat geçmişi (flapping tespiti + trend + debug)
  await prisma.stockSnapshot
    .create({
      data: {
        productId,
        amazonPrice: newAmazonPrice,
        stockStatus,
        stockQty,
        ebayPrice: newEbayPrice,
        source: recovery ? "recovery" : "poll",
      },
    })
    .catch(() => {});

  if (shouldPause) {
    job.log(`Duraklatıldı (${pauseReason}) stok=${stockStatus}(${stockQty ?? "∞"}): ${product.asin}`);
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
  let skipCount = 0;
  let blockedCount = 0;

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

      // Fiyat/stok + status'u DB'ye her zaman yaz (kayıt taze kalsın)
      await prisma.listing.update({
        where: { id: listing.id },
        data: { currentPrice: ebayPrice, currentQty: newQty, status: "active" },
      });

      if (!listing.ebayListingId) {
        // YENİDEN DOĞRULAMA (ilk yayın kapısı) — depo başlığı (product.title, in-memory
        // baseline) ile o an canlı çekilen başlık (scraped.title) tutarlı mı? ASIN farklı
        // ürüne dönüştürülmüşse müşterinin mağazasına YANLIŞ ürün düşmesin → yayını engelle.
        const reval = revalidateListingTitle(product.title, scraped.title);
        if (!reval.ok) {
          blockedCount++;
          await prisma.listing.update({
            where: { id: listing.id },
            data: { status: "paused", currentQty: 0, lastEbayError: `revalidate: ${reval.reason}` },
          });
          job.log(`Yayın ENGELLENDI (revalidate): ${reval.reason} | listing ${listing.id} | ${product.asin}`);
          return undefined;
        }
        publishCount++;
        return publishListingQueue.add(
          "publish-listing",
          { listingId: listing.id, ebayAccountId: listing.ebayAccountId },
          { jobId: `publish-listing:${listing.id}:${Date.now()}` }
        );
      }

      // HİSTEREZİS: reaktivasyon/stok değişimi yoksa ve fiyat farkı önemsizse
      // eBay'e dokunma (gereksiz API trafiği + fiyat flapping önlenir).
      const priceChanged = isSignificantChange(listing.currentPrice, ebayPrice);
      const qtyChanged = listing.currentQty !== newQty;
      if (!wasPaused && !priceChanged && !qtyChanged) {
        skipCount++;
        return undefined;
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
    `Tamamlandı${recovery ? " (RECOVERY)" : ""}: ${product.asin} | eBay: $${newEbayPrice?.toFixed(2) ?? "?"} | stok: ${stockStatus}(${stockQty ?? "∞"}) | yayınla=${publishCount} güncelle=${updateCount} reaktive=${reactivateCount} atlanan(histerezis)=${skipCount} engellenen(revalidate)=${blockedCount}`
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
