// shopify-poll-orders worker — Shopify mağazalarındaki siparişleri çeker.
// amazon-poll-orders'ın Shopify karşılığı: 30 dakikada bir tüm aktif hesaplar
// taranır (data.shopifyAccountId verilirse tek hesap).
//
// Sipariş-anı kaynak kontrolü (ORTAK DEPO deseni): yeni sipariş kaydedilirken
// kalemler ShopifyListing → AmazonDepotProduct üzerinden eşlenir; depo verisi
// zaten periyodik AliExpress taramasıyla taze olduğundan DIŞ ÇAĞRI YAPILMADAN
// stok riski (ali_stock_risk) ve kaynak maliyeti (aliCostUsd) damgalanır.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { fetchShopifyOrders } from "@/lib/shopify/orders";
import type { FetchedShopifyOrder } from "@/lib/shopify/orders";
import type { ShopifyPollOrdersJobData } from "@/lib/queues";

// İlk senkronda en fazla bu kadar geriye bakılır; sonraki turlar kaldığı yerden
// 1 saat overlap ile devam eder (saat kayması/geciken sipariş kaçmasın).
const FIRST_SYNC_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const OVERLAP_MS = 60 * 60 * 1000;

interface StoredLineItem {
  title: string;
  quantity: number;
  shopifyProductId: string | null;
  listingId?: string;
  depotProductId?: string;
  // AliExpress ürün ID — sipariş ekranında "AliExpress'te aç" linki için
  // (mağaza sahibi siparişi tek tıkla kaynaktan kendisi verir)
  aliId?: string;
}

async function syncAccountOrders(
  account: {
    id: string;
    userId: string;
    shopDomain: string;
    accessTokenEncrypted: string | null;
    lastOrdersSyncAt: Date | null;
  },
  log: (msg: string) => void
): Promise<void> {
  if (!account.accessTokenEncrypted) {
    log(`Token yok — atlandı: ${account.shopDomain}`);
    return;
  }

  const token = decryptToken(account.accessTokenEncrypted);
  const syncStart = new Date();
  const since = account.lastOrdersSyncAt
    ? new Date(account.lastOrdersSyncAt.getTime() - OVERLAP_MS)
    : new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS);

  const orders = await fetchShopifyOrders(account.shopDomain, token, since);

  let created = 0;
  for (const order of orders) {
    const saved = await upsertOrder(account, order);
    if (saved) created += 1;
  }

  await prisma.shopifyAccount.update({
    where: { id: account.id },
    data: { lastOrdersSyncAt: syncStart },
  });

  log(`${account.shopDomain}: ${orders.length} sipariş tarandı, ${created} yeni`);
}

/** Siparişi kaydeder; yeni oluşturulduysa true döner. Var olanda yalnız durum güncellenir. */
async function upsertOrder(
  account: { id: string; userId: string },
  order: FetchedShopifyOrder
): Promise<boolean> {
  const existing = await prisma.shopifyOrder.findUnique({
    where: {
      shopifyAccountId_shopifyOrderId: {
        shopifyAccountId: account.id,
        shopifyOrderId: order.shopifyOrderId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    // Durum akışı (ödeme/kargo) değişmiş olabilir — kalem/kaynak analizi ilk
    // kayıttaki haliyle kalır (sipariş anındaki fotoğraf değerlidir).
    await prisma.shopifyOrder.update({
      where: { id: existing.id },
      data: {
        financialStatus: order.financialStatus,
        fulfillmentStatus: order.fulfillmentStatus,
      },
    });
    return false;
  }

  // Kalemleri ortak depoya eşle: shopifyProductId → ShopifyListing → depot ürünü
  const productGids = order.lineItems
    .map((li) => li.shopifyProductId)
    .filter((gid): gid is string => Boolean(gid));

  const listings = productGids.length
    ? await prisma.shopifyListing.findMany({
        where: { shopifyAccountId: account.id, shopifyProductId: { in: productGids } },
        select: {
          id: true,
          shopifyProductId: true,
          productId: true,
          product: {
            select: { aliId: true, aliCostUsd: true, aliShippingUsd: true, aliStockStatus: true },
          },
        },
      })
    : [];
  const byGid = new Map(listings.map((l) => [l.shopifyProductId, l]));

  let aliCostUsd = 0;
  let matchedAny = false;
  let stockRisk = false;
  const storedItems: StoredLineItem[] = order.lineItems.map((li) => {
    const listing = li.shopifyProductId ? byGid.get(li.shopifyProductId) : undefined;
    if (!listing) return { ...li };
    matchedAny = true;
    aliCostUsd += (listing.product.aliCostUsd + listing.product.aliShippingUsd) * li.quantity;
    if (listing.product.aliStockStatus !== "in_stock") stockRisk = true;
    return { ...li, listingId: listing.id, depotProductId: listing.productId, aliId: listing.product.aliId };
  });

  const sourcingStatus = !matchedAny ? "unlinked" : stockRisk ? "ali_stock_risk" : "ok";

  await prisma.shopifyOrder.create({
    data: {
      userId: account.userId,
      shopifyAccountId: account.id,
      shopifyOrderId: order.shopifyOrderId,
      name: order.name,
      totalPrice: order.totalPrice,
      currency: order.currency,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      lineItems: storedItems as unknown as Prisma.InputJsonValue,
      sourcingStatus,
      aliCostUsd: matchedAny ? Math.round(aliCostUsd * 100) / 100 : null,
      shopifyCreatedAt: new Date(order.createdAt),
    },
  });
  return true;
}

async function processShopifyPollOrders(job: Job<ShopifyPollOrdersJobData>): Promise<void> {
  const log = (msg: string) => void job.log(msg);

  const accounts = await prisma.shopifyAccount.findMany({
    where: {
      isActive: true,
      uninstalledAt: null,
      accessTokenEncrypted: { not: null },
      ...(job.data.shopifyAccountId ? { id: job.data.shopifyAccountId } : {}),
    },
    select: {
      id: true,
      userId: true,
      shopDomain: true,
      accessTokenEncrypted: true,
      lastOrdersSyncAt: true,
    },
  });

  if (accounts.length === 0) return;

  // Hesaplar sırayla işlenir (Shopify hız limiti mağaza başınadır ama tek job
  // içinde paralel patlatmanın anlamı yok); bir hesabın hatası diğerini durdurmaz.
  let failed = 0;
  for (const account of accounts) {
    try {
      await syncAccountOrders(account, log);
    } catch (err) {
      failed += 1;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[shopify-poll-orders] ${account.shopDomain} hatası: ${errMsg}`);
    }
  }

  // Tek hesap istendiyse ve o da başarısızsa job fail olsun (BullMQ retry);
  // toplu turda kısmi hata normaldir, bir sonraki tur telafi eder.
  if (failed > 0 && accounts.length === 1) {
    throw new Error(`Sipariş senkronu başarısız: ${accounts[0].shopDomain}`);
  }
}

export function createShopifyPollOrdersWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<ShopifyPollOrdersJobData>(
    "shopify-poll-orders",
    processShopifyPollOrders,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[shopify-poll-orders] ✓ ${job.id}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[shopify-poll-orders] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[shopify-poll-orders] worker hatası:", err));

  return worker;
}
