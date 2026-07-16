// AmazonBot sipariş çekme — SP-API getOrders → AmazonOrder'a yazar (Siparişlerim'e düşer).
// SP-API bağlı değilse net hata (job fail) — beklenen.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getSpapiAccessToken, getOrders, getOrderItems, isSpapiConfigured } from "@/lib/amazon-spapi";
import { amazonVerifyOrderQueue, type AmazonPollOrdersJobData } from "@/lib/queues";

/**
 * Siparişi kendi AmazonListing kaydımıza bağlar (SİPARİŞ-ANI DOĞRULAMANIN ÖN KOŞULU).
 * getOrderItems → SKU (bizim ürettiğimiz, en güvenilir) veya ASIN ile hesabın
 * ilanı bulunur. Eşleşme yoksa null — verify worker "eşlenemedi" notu düşer.
 */
async function linkOrderToListing(
  accountId: string,
  market: string,
  accessToken: string,
  amazonOrderId: string,
  log: (m: string) => void
): Promise<{ listingId: string; qty: number } | null> {
  let items;
  try {
    items = await getOrderItems(market, accessToken, amazonOrderId);
  } catch (err) {
    log(`getOrderItems hatası (${amazonOrderId}): ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  if (!items.length) return null;

  const item = items[0];
  const totalQty = items.reduce((s, i) => s + (i.quantityOrdered || 1), 0);

  // Önce SKU (tenant'a özgü, bizim ürettiğimiz) — sonra ASIN yoluna düş
  const listing = await prisma.amazonListing.findFirst({
    where: {
      amazonAccountId: accountId,
      OR: [
        ...(item.sellerSku ? [{ sku: item.sellerSku }] : []),
        { asin: item.asin },
      ],
    },
    select: { id: true },
  });

  return listing ? { listingId: listing.id, qty: totalQty } : null;
}

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

    // İlan eşlemesi yoksa kur — sipariş-anı doğrulama (canlı AliExpress stok/fiyat
    // kontrolü) ancak sipariş bir ilana bağlıysa çalışabilir.
    let listingLinked = Boolean(saved.listingId);
    if (!listingLinked) {
      const link = await linkOrderToListing(
        account.id, account.market, accessToken, o.amazonOrderId, log
      );
      if (link) {
        await prisma.amazonOrder.update({
          where: { id: saved.id },
          data: { listingId: link.listingId, qty: link.qty },
        });
        listingLinked = true;
      }
    }

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

  // Yalnızca AKTİF (abonelik/deneme süresi devam eden) hesaplar taranır —
  // dondurulmuş hesabın siparişi işlenmez, oto-fulfillment tetiklenmez.
  const accounts = await prisma.amazonAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  log(`Toplu sipariş çekme: ${accounts.length} aktif hesap`);
  for (const a of accounts) {
    try {
      await pollAccount(a.id, log);
    } catch (err) {
      log(`Hesap ${a.id} hata: ${err instanceof Error ? err.message : String(err)}`);
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
