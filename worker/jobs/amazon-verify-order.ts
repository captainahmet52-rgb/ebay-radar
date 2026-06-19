// AmazonBot sipariş-anı doğrulama (EN KRİTİK KORUMA) — sipariş gelince, kargolanmadan
// ÖNCE AliExpress'ten canlı stok + fiyat çekilir. Stok bitmiş / fiyat zıplamışsa sipariş
// "risk" işaretlenir (kullanıcı iade/iptal eder). eBay verify-order'ın Amazon karşılığı.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { fetchAliExpressProduct } from "@/lib/aliexpress";
import { isPriceSpike } from "@/lib/amazon-repricer";
import { amazonFulfillOrderQueue, type AmazonVerifyOrderJobData } from "@/lib/queues";

async function processVerifyOrder(job: Job<AmazonVerifyOrderJobData>): Promise<void> {
  const { orderId } = job.data;

  const order = await prisma.amazonOrder.findUnique({
    where: { id: orderId },
    include: { listing: { include: { product: true } } },
  });

  if (!order || order.verifiedAt) return; // yok ya da zaten doğrulanmış

  const product = order.listing?.product;
  if (!product) {
    // Ürün eşlenemiyorsa doğrulama yapılamaz — not düş, geç
    await prisma.amazonOrder.update({
      where: { id: orderId },
      data: { verifiedAt: new Date(), verifyNote: "Ürün eşlenemedi — doğrulama atlandı" },
    });
    return;
  }

  // Canlı AliExpress verisi (kaynak bağlı değilse job fail olur — beklenen)
  const ali = await fetchAliExpressProduct(product.aliId);

  let risk: string | null = null;
  if (ali.stockStatus === "out" || ali.stockStatus === "unknown") {
    risk = "AliExpress stoğu tükendi";
  } else if (ali.stockStatus === "low" && (ali.stockQty ?? 0) < 3) {
    risk = `AliExpress stoğu kritik: ${ali.stockQty} adet`;
  } else if (isPriceSpike(product.aliCostUsd, ali.costUsd)) {
    risk = `AliExpress fiyatı zıpladı: $${product.aliCostUsd} → $${ali.costUsd}`;
  }

  // Depo ürününü taze veriyle güncelle
  await prisma.amazonDepotProduct.update({
    where: { id: product.id },
    data: {
      aliCostUsd: ali.costUsd,
      aliShippingUsd: ali.shippingUsd,
      aliStockStatus: ali.stockStatus,
      aliStockQty: ali.stockQty,
      lastScrapedAt: new Date(),
      ...(risk ? { status: "paused" } : {}),
    },
  });

  await prisma.amazonOrder.update({
    where: { id: orderId },
    data: {
      verifiedAt: new Date(),
      verifyNote: risk ?? "Uygun — kargolanabilir",
      ...(risk ? { status: "risk" } : {}),
    },
  });

  // Güvenliyse ve kullanıcı oto-sipariş açtıysa → AliExpress'e oto-buy
  if (!risk && !order.aliOrderId) {
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { amazonAutoFulfill: true },
    });
    if (user?.amazonAutoFulfill) {
      await amazonFulfillOrderQueue.add(
        "amazon-fulfill-order",
        { orderId },
        { jobId: `amazon-fulfill:${orderId}` }
      );
    }
  }

  await job.log(
    risk ? `SİPARİŞ RİSKLİ: ${orderId} — ${risk}` : `Sipariş doğrulandı: ${orderId}`
  );
}

export function createAmazonVerifyOrderWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonVerifyOrderJobData>(
    "amazon-verify-order",
    processVerifyOrder,
    { connection, concurrency: 4, limiter: { max: 20, duration: 1000 } }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-verify-order] ✓ ${job.id} | ${job.data.orderId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-verify-order] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-verify-order] worker hatası:", err));

  return worker;
}
