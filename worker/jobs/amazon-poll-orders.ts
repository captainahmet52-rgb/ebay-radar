// AmazonBot sipariş çekme — SP-API getOrders → AmazonOrder'a yazar (Siparişlerim'e düşer).
// SP-API bağlı değilse net hata (job fail) — beklenen.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getSpapiAccessToken, getOrders, isSpapiConfigured } from "@/lib/amazon-spapi";
import { amazonVerifyOrderQueue, type AmazonPollOrdersJobData } from "@/lib/queues";

async function pollAccount(accountId: string, log: (m: string) => void): Promise<void> {
  const account = await prisma.amazonAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.spapiRefreshTokenEncrypted) return;

  const refreshToken = decryptToken(account.spapiRefreshTokenEncrypted);
  const { accessToken } = await getSpapiAccessToken(refreshToken);

  // Son 2 günün siparişleri (tarama aralığı güvenli payı)
  const createdAfter = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const orders = await getOrders(account.market, accessToken, createdAfter);

  log(`Hesap ${accountId} (${account.market}): ${orders.length} sipariş`);

  for (const o of orders) {
    if (!o.amazonOrderId) continue;
    const soldPrice = o.orderTotal ? Number(o.orderTotal.amount) : null;

    const saved = await prisma.amazonOrder.upsert({
      where: { amazonOrderId: o.amazonOrderId },
      create: {
        userId: account.userId,
        amazonAccountId: account.id,
        amazonOrderId: o.amazonOrderId,
        market: account.market,
        soldPrice,
        status: o.orderStatus.toLowerCase(),
      },
      update: { status: o.orderStatus.toLowerCase(), ...(soldPrice != null ? { soldPrice } : {}) },
    });

    // Henüz doğrulanmamış siparişi sipariş-anı doğrulamaya gönder (canlı stok/fiyat)
    if (!saved.verifiedAt) {
      await amazonVerifyOrderQueue.add(
        "amazon-verify-order",
        { orderId: saved.id },
        { jobId: `amazon-verify:${saved.id}` }
      );
    }
  }
}

async function processAmazonPollOrders(job: Job<AmazonPollOrdersJobData>): Promise<void> {
  const log = (m: string) => { void job.log(m); };

  if (!isSpapiConfigured()) {
    throw new Error("SP-API yapılandırılmadı — sipariş çekilemez (API en sonda bağlanacak)");
  }

  if (job.data.amazonAccountId) {
    await pollAccount(job.data.amazonAccountId, log);
    return;
  }

  const accounts = await prisma.amazonAccount.findMany({ select: { id: true } });
  log(`Toplu sipariş çekme: ${accounts.length} hesap`);
  for (const a of accounts) {
    try {
      await pollAccount(a.id, log);
    } catch (err) {
      log(`Hesap ${a.id} hata: ${err instanceof Error ? err.message : err}`);
    }
  }
}

export function createAmazonPollOrdersWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonPollOrdersJobData>(
    "amazon-poll-orders",
    processAmazonPollOrders,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-poll-orders] ✓ ${job.id} | ${job.data.amazonAccountId ?? "ALL"}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-poll-orders] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-poll-orders] worker hatası:", err));

  return worker;
}
