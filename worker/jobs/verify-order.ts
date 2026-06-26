// verify-order worker — Sipariş-anı doğrulama (EN KRİTİK KORUMA)
// eBay sipariş webhook'u geldiğinde, sipariş işlenmeden önce
// Amazon fiyat + stok canlı kontrol edilir.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct, ScraperOutOfCreditsError } from "@/lib/scraper";
import { cancelOrder } from "@/lib/ebay/fulfillment";
import { fulfillEbayOrder } from "@/lib/ebay/fulfill-order";
import { notifyScraperOutOfCredits } from "@/lib/admin-notify";
import { updateListingQueue, type VerifyOrderJobData } from "@/lib/queues";

// ─── Job işleyici ─────────────────────────────────────────────────────────────
async function processVerifyOrder(
  job: Job<VerifyOrderJobData>
): Promise<void> {
  const { orderId } = job.data;

  // 1. Order + Listing + Product çek
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      listing: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error(`Order bulunamadı: ${orderId}`);
  }

  if (order.fulfillmentStatus !== "pending") {
    job.log(
      `Order zaten işlenmiş (${order.fulfillmentStatus}) — atlanıyor: ${orderId}`
    );
    return;
  }

  const { listing } = order;
  const { product } = listing;

  if (!product) {
    throw new Error(`Listing'e bağlı product bulunamadı: ${listing.id}`);
  }

  if (!product.asin) {
    throw new Error(`Product'ta ASIN yok: ${product.id}`);
  }

  const soldPrice = order.soldPrice;
  if (soldPrice === null) {
    throw new Error(`Order'da soldPrice yok: ${orderId}`);
  }

  job.log(
    `Sipariş doğrulanıyor: ${orderId} | ASIN: ${product.asin} | Satış fiyatı: $${soldPrice}`
  );

  // 2. ScrapingBee ile CANLI Amazon verisi çek.
  //    Hata olursa job FAIL eder → sipariş "pending" kalır (fail-closed: asla körlemesine onaylama).
  let scraped;
  try {
    scraped = await fetchAmazonProduct(product.asin, product.amazonMarket ?? "US");
  } catch (err) {
    if (err instanceof ScraperOutOfCreditsError) {
      await notifyScraperOutOfCredits("sipariş doğrulama").catch(() => {});
    }
    throw err;
  }

  const liveAmazonPrice = scraped.price;
  const { stockStatus, stockQty } = scraped;

  job.log(
    `Canlı Amazon verisi: fiyat=$${liveAmazonPrice ?? "N/A"}, stok=${stockStatus}(${stockQty ?? "∞"})`
  );

  // Stok geçmişine kaydet (sipariş-anı canlı kontrol)
  await prisma.stockSnapshot
    .create({
      data: {
        productId: product.id,
        amazonPrice: liveAmazonPrice,
        stockStatus,
        stockQty,
        source: "verify",
      },
    })
    .catch(() => {});

  // Makine-okunur iptal sebebi kodu (analitik + pauseReason + eBay enum eşlemesi için).
  // null → iptal yok. "out_of_stock" | "low_stock" | "price_spike".
  let cancelCode: "out_of_stock" | "low_stock" | "price_spike" | null = null;
  // İnsan-okunur açıklama (loglar için).
  let cancelDetail: string | null = null;

  // 3a. Stok kontrolü: "out" veya kritik az stok (1–2 adet) → iptal
  if (stockStatus === "out") {
    cancelCode = "out_of_stock";
    cancelDetail = "Amazon stoku tükendi";
  } else if (stockStatus === "low") {
    const qty = stockQty ?? 1;
    if (qty < 3) {
      cancelCode = "low_stock";
      cancelDetail = `Amazon stok kritik seviyede düşük: ${qty} adet`;
    }
  }

  // 3b. Fiyat kontrolü: Canlı Amazon fiyatı satış fiyatının %20'sinden fazla üstündeyse → iptal
  // Formül: satışta kazanılan margin = (soldPrice - amazon_cost) / soldPrice
  // Eğer amazon maliyeti arttıysa margin erimişse iptal et
  if (cancelCode === null && liveAmazonPrice !== null) {
    // Satışta varsayılan komisyon + target margin ile kırılım noktası
    // Kırılım: liveAmazonPrice > soldPrice'ın %20 üstü = zarar guarantee
    const priceThreshold = soldPrice * 1.2; // soldPrice'ın %20 üstü
    if (liveAmazonPrice > priceThreshold) {
      cancelCode = "price_spike";
      cancelDetail = `Amazon fiyatı çok yükseldi: $${liveAmazonPrice.toFixed(2)} > eşik $${priceThreshold.toFixed(2)}`;
    }
  }

  // 4. Sonucu kaydet
  const now = new Date();

  if (cancelCode) {
    // OVERSELL FRENİ — SIRA KRİTİK. cancelCode belirlendiği anda, order "cancelled"
    // yapılMADAN ÖNCE eBay listing'i qty 0'a çekecek işi (Redis'te kalıcı) kuyruğa at.
    // Neden önce: processVerifyOrder başında `fulfillmentStatus !== "pending"` guard'ı
    // var. Eğer önce order'ı "cancelled" yapıp sonra qty-0 enqueue çökerse, job retry
    // erken-return'e takılır → eBay'de ürün satılabilir kalır = OVERSELL. qty-0'ı önce
    // garanti edersek order hâlâ "pending"dir, retry buraya tekrar girer.
    // jobId stable (Date.now() YOK) → tekrar enqueue idempotent. Hata YUTULMAZ:
    // throw → job fail → retry; oversell sessizce kaybolmaz.
    if (listing.ebayListingId) {
      await updateListingQueue.add(
        "update-listing",
        { listingId: listing.id, price: listing.currentPrice ?? 0, qty: 0 },
        { jobId: `pause-listing:${listing.id}` }
      );
    }

    // Önce eBay'de siparişi gerçekten iptal et. Başarısız olursa hata fırlar,
    // job retry yapar — DB'yi "cancelled" işaretleyip eBay'de canlı bırakmayız.
    // Token/secret loglanmaz; ebayOrderId yoksa eBay'de iptal edilecek bir şey yok.
    // eBay'in kabul ettiği enum sınırlı; satıcı-karşılayamıyor (stok/fiyat) → OUT_OF_STOCK.
    // Gerçek iç sebep (price_spike dahil) DB'ye cancelCode olarak ayrıca yazılır.
    if (order.ebayOrderId) {
      await cancelOrder(
        listing.ebayAccountId,
        order.ebayOrderId,
        "OUT_OF_STOCK"
      );
    } else {
      console.warn(
        `[verify-order] ebayOrderId yok — eBay iptali atlanıyor: ${orderId}`
      );
    }

    // Listing'i duraklat (DB) — eBay qty-0 işi yukarıda zaten enqueue edildi.
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "paused", currentQty: 0 },
    });

    // Sipariş iptal (en son: artık eBay güvende + listing paused)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: "cancelled",
        cancellationReason: cancelCode,
        verifiedAt: now,
      },
    });

    // Product durumunu güncelle (recovery'nin geri açabilmesi için pauseReason)
    await prisma.product.update({
      where: { id: product.id },
      data: {
        amazonPrice: liveAmazonPrice ?? product.amazonPrice,
        amazonStockStatus: stockStatus,
        amazonStockQty: stockQty,
        status: "paused",
        pauseReason: cancelCode,
        lastScrapedAt: now,
      },
    });

    job.log(
      `SIPARIŞ İPTAL: ${orderId} | Sebep: ${cancelCode} (${cancelDetail ?? "—"})`
    );

    console.warn(
      `[verify-order] ⚠ Sipariş eBay'de iptal edildi: ${orderId} | Sebep: ${cancelCode} (${cancelDetail ?? "—"}) | eBay order: ${order.ebayOrderId ?? "N/A"}`
    );
  } else {
    // Sipariş onaylandı
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: "verified",
        verifiedAt: now,
        amazonPriceAtSale: liveAmazonPrice,
        // Net kâr = soldPrice - amazon_cost - ebay_fee - fixedFee
        ...(liveAmazonPrice !== null
          ? {
              netProfit:
                soldPrice -
                liveAmazonPrice -
                soldPrice * product.ebayFeeRate -
                (soldPrice >= 10 ? 0.4 : 0.3),
            }
          : {}),
      },
    });

    // Product güncel verisini de kaydet
    await prisma.product.update({
      where: { id: product.id },
      data: {
        amazonPrice: liveAmazonPrice ?? product.amazonPrice,
        amazonStockStatus: stockStatus,
        amazonStockQty: stockQty,
        lastScrapedAt: now,
      },
    });

    job.log(
      `SIPARIŞ DOĞRULANDI: ${orderId} | Amazon: $${liveAmazonPrice?.toFixed(2)} | Satış: $${soldPrice.toFixed(2)}`
    );

    // 5. Oto-kargolama açıksa: takip no al + eBay'e yükle (cüzdandan $0.43)
    //    Kargolama hatası verify job'ını DÜŞÜRMEZ (kendi içinde iade/bildirim yapar).
    const owner = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { ebayAutoFulfill: true },
    });
    if (owner?.ebayAutoFulfill) {
      try {
        const r = await fulfillEbayOrder(orderId);
        job.log(`OTO-KARGOLANDI: ${orderId} | ${r.carrierCode} ${r.trackingNumber}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        job.log(`Oto-kargolama yapılamadı (${orderId}): ${msg}`);
      }
    }
  }
}

// ─── Worker factory ────────────────────────────────────────────────────────────
export function createVerifyOrderWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<VerifyOrderJobData>(
    "verify-order",
    processVerifyOrder,
    {
      connection,
      concurrency: 4,
      // Sipariş doğrulama kuyruğunda öncelik yüksek — limiter ekle
      limiter: {
        max: 20,
        duration: 1000, // saniyede max 20 sipariş doğrulama
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(
      `[verify-order] ✓ Job tamamlandı: ${job.id} | orderId: ${job.data.orderId}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[verify-order] ✗ Job başarısız: ${job?.id} | orderId: ${job?.data.orderId} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error(`[verify-order] Worker hatası:`, err);
  });

  return worker;
}
