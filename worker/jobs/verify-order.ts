// verify-order worker — Sipariş-anı doğrulama (EN KRİTİK KORUMA)
// eBay sipariş webhook'u geldiğinde, sipariş işlenmeden önce
// Amazon fiyat + stok canlı kontrol edilir.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct } from "@/lib/scraper";
import { cancelOrder } from "@/lib/ebay/fulfillment";
import type { VerifyOrderJobData } from "@/lib/queues";

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

  // 2. ScrapingBee ile CANLI Amazon verisi çek
  const scraped = await fetchAmazonProduct(product.asin);

  const liveAmazonPrice = scraped.price;
  const { stockStatus, stockQty } = scraped;

  job.log(
    `Canlı Amazon verisi: fiyat=$${liveAmazonPrice ?? "N/A"}, stok=${stockStatus}(${stockQty ?? "∞"})`
  );

  let cancellationReason: string | null = null;

  // 3a. Stok kontrolü: "out" veya kritik az stok (1–2 adet) → iptal
  if (stockStatus === "out") {
    cancellationReason = "Amazon stoku tükendi";
  } else if (stockStatus === "low") {
    const qty = stockQty ?? 1;
    if (qty < 3) {
      cancellationReason = `Amazon stok kritik seviyede düşük: ${qty} adet`;
    }
  }

  // 3b. Fiyat kontrolü: Canlı Amazon fiyatı satış fiyatının %20'sinden fazla üstündeyse → iptal
  // Formül: satışta kazanılan margin = (soldPrice - amazon_cost) / soldPrice
  // Eğer amazon maliyeti arttıysa margin erimişse iptal et
  if (!cancellationReason && liveAmazonPrice !== null) {
    // Satışta varsayılan komisyon + target margin ile kırılım noktası
    // Kırılım: liveAmazonPrice > soldPrice'ın %20 üstü = zarar guarantee
    const priceThreshold = soldPrice * 1.2; // soldPrice'ın %20 üstü
    if (liveAmazonPrice > priceThreshold) {
      cancellationReason = `Amazon fiyatı çok yükseldi: $${liveAmazonPrice.toFixed(2)} > eşik $${priceThreshold.toFixed(2)}`;
    }
  }

  // 4. Sonucu kaydet
  const now = new Date();

  if (cancellationReason) {
    // Önce eBay'de siparişi gerçekten iptal et. Başarısız olursa hata fırlar,
    // job retry yapar — DB'yi "cancelled" işaretleyip eBay'de canlı bırakmayız.
    // Token/secret loglanmaz; ebayOrderId yoksa eBay'de iptal edilecek bir şey yok.
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

    // Sipariş iptal
    await prisma.order.update({
      where: { id: orderId },
      data: {
        fulfillmentStatus: "cancelled",
        cancellationReason: "out_of_stock",
        verifiedAt: now,
      },
    });

    // Listing'i duraklat
    await prisma.listing.update({
      where: { id: listing.id },
      data: { status: "paused", currentQty: 0 },
    });

    // Product durumunu güncelle
    await prisma.product.update({
      where: { id: product.id },
      data: {
        amazonPrice: liveAmazonPrice ?? product.amazonPrice,
        amazonStockStatus: stockStatus,
        amazonStockQty: stockQty,
        status: "paused",
        lastScrapedAt: now,
      },
    });

    job.log(
      `SIPARIŞ İPTAL: ${orderId} | Sebep: ${cancellationReason}`
    );

    console.warn(
      `[verify-order] ⚠ Sipariş eBay'de iptal edildi: ${orderId} | Sebep: ${cancellationReason} | eBay order: ${order.ebayOrderId ?? "N/A"}`
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
