// AmazonBot oto-sipariş — doğrulanmış sipariş için AliExpress'e otomatik sipariş verir (oto-buy).
// Amazon teslim adresi SP-API'den (RDT) çekilir, AliExpress'e iletilir, aliOrderId saklanır.
// Sadece kullanıcı amazonAutoFulfill açıksa çalışır. Takip no daha sonra tracking-sync ile çekilir.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getSpapiAccessToken, getOrderAddress, isSpapiConfigured } from "@/lib/amazon-spapi";
import { placeAliExpressOrder, isAliExpressConfigured } from "@/lib/aliexpress";
import type { AmazonFulfillOrderJobData } from "@/lib/queues";

async function processFulfillOrder(job: Job<AmazonFulfillOrderJobData>): Promise<void> {
  const { orderId } = job.data;

  if (!isSpapiConfigured() || !isAliExpressConfigured()) {
    throw new Error("SP-API veya AliExpress bağlı değil — oto-sipariş yapılamaz (API en sonda)");
  }

  const order = await prisma.amazonOrder.findUnique({
    where: { id: orderId },
    include: { listing: { include: { product: true, amazonAccount: true } } },
  });

  if (!order || order.aliOrderId) return; // yok ya da zaten sipariş verilmiş
  if (order.status === "risk") return;     // riskli sipariş — oto-buy yapma

  const account = order.listing?.amazonAccount;
  const product = order.listing?.product;
  if (!account?.spapiRefreshTokenEncrypted || !product) {
    await job.log(`Eşleşme/hesap eksik — atlanıyor: ${orderId}`);
    return;
  }

  // 1. Amazon teslim adresini al (RDT)
  const { accessToken } = await getSpapiAccessToken(decryptToken(account.spapiRefreshTokenEncrypted));
  const addr = await getOrderAddress(account.market, accessToken, order.amazonOrderId);

  // 2. AliExpress'e sipariş ver
  const { aliOrderId } = await placeAliExpressOrder({
    productId: product.aliId,
    quantity: order.qty,
    address: {
      contact_person: addr.name ?? "",
      address: addr.addressLine1 ?? "",
      address2: addr.addressLine2 ?? "",
      city: addr.city ?? "",
      province: addr.stateOrRegion ?? "",
      zip: addr.postalCode ?? "",
      country: addr.countryCode ?? "",
      phone_country: "",
      mobile_no: addr.phone ?? "",
    },
  });

  // 3. aliOrderId sakla — takip no'yu tracking-sync çekecek
  await prisma.amazonOrder.update({
    where: { id: orderId },
    data: { aliOrderId, status: "shipped" },
  });

  await job.log(`AliExpress siparişi verildi: ${orderId} → ${aliOrderId}`);
}

export function createAmazonFulfillOrderWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonFulfillOrderJobData>(
    "amazon-fulfill-order",
    processFulfillOrder,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-fulfill-order] ✓ ${job.id} | ${job.data.orderId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-fulfill-order] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-fulfill-order] worker hatası:", err));

  return worker;
}
