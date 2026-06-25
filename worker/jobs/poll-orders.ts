// poll-orders worker — bir EbayAccount'un yeni siparişlerini çeker,
// DB'ye Order kaydı oluşturur ve her birini verify-order kuyruğuna ekler.
//
// Akış:
//   1. EbayAccount'un en son Order'ının createdAt'i (lastOrderPollAt) bulunur
//   2. getNewOrders(ebayAccountId, lastOrderPollAt) ile NOT_STARTED siparişler çekilir
//   3. Her sipariş için: listing SKU/listingId ile bulunur, yoksa atlanır
//   4. ebayOrderId DB'de zaten varsa atlanır (idempotent)
//   5. Yoksa Order (fulfillmentStatus: "pending") oluşturulup verify-order'a eklenir
//
// Güvenlik: token/secret loglanmaz. Tek siparişin hatası diğerlerini durdurmaz.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNewOrders, type EbayOrder } from "@/lib/ebay/fulfillment";
import { verifyOrderQueue } from "@/lib/queues";
import type { PollOrdersJobData } from "@/lib/queues";

/**
 * Bir eBay siparişinin lineItem'larından eşleşen Listing'i bulur.
 * Önce ebaySku, sonra ebayListingId üzerinden eşler.
 */
async function findListing(
  ebayAccountId: string,
  ebayOrder: EbayOrder
): Promise<{ id: string; userId: string; productId: string } | null> {
  const skus = ebayOrder.lineItems
    .map((li) => li.sku)
    .filter((s): s is string => typeof s === "string" && s.length > 0);

  const listingIds = ebayOrder.lineItems
    .map((li) => li.listingId)
    .filter((l): l is string => typeof l === "string" && l.length > 0);

  const orConditions: Array<Record<string, unknown>> = [];
  if (skus.length > 0) {
    orConditions.push({ ebaySku: { in: skus } });
  }
  if (listingIds.length > 0) {
    orConditions.push({ ebayListingId: { in: listingIds } });
  }

  if (orConditions.length === 0) {
    return null;
  }

  return prisma.listing.findFirst({
    where: {
      ebayAccountId,
      OR: orConditions,
    },
    select: { id: true, userId: true, productId: true },
  });
}

async function processPollOrders(job: Job<PollOrdersJobData>): Promise<void> {
  const { ebayAccountId } = job.data;

  // 1. Bu hesabın en son siparişinin tarihini bul (delta polling).
  const account = await prisma.ebayAccount.findUnique({
    where: { id: ebayAccountId },
    select: { id: true },
  });

  if (!account) {
    throw new Error(`EbayAccount bulunamadı: ${ebayAccountId}`);
  }

  const lastOrder = await prisma.order.findFirst({
    where: { listing: { ebayAccountId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const lastOrderPollAt = lastOrder?.createdAt;

  // 2. eBay'den yeni siparişleri çek.
  const ebayOrders = await getNewOrders(ebayAccountId, lastOrderPollAt);

  await job.log(
    `${ebayOrders.length} NOT_STARTED sipariş alındı (since=${lastOrderPollAt?.toISOString() ?? "başlangıç"})`
  );

  let createdCount = 0;
  let skippedExisting = 0;
  let skippedNoListing = 0;

  // 3. Her siparişi işle — biri patlarsa diğerlerine devam et.
  for (const ebayOrder of ebayOrders) {
    try {
      // b. Aynı ebayOrderId zaten kayıtlıysa atla (idempotent).
      const existing = await prisma.order.findFirst({
        where: { ebayOrderId: ebayOrder.orderId },
        select: { id: true },
      });
      if (existing) {
        skippedExisting++;
        continue;
      }

      // a. Listing'i SKU veya listingId ile bul.
      const listing = await findListing(ebayAccountId, ebayOrder);
      if (!listing) {
        skippedNoListing++;
        console.warn(
          `[poll-orders] Eşleşen listing yok — atlanıyor: ebayOrder=${ebayOrder.orderId} account=${ebayAccountId}`
        );
        continue;
      }

      const soldPrice =
        ebayOrder.totalAmount !== undefined
          ? Number.parseFloat(ebayOrder.totalAmount)
          : null;

      // Kargo bildirimi için ilk satır kalemi ID'si (varsa)
      const ebayLineItemId = ebayOrder.lineItems.find((li) => li.lineItemId)?.lineItemId ?? null;
      const ship = ebayOrder.shipTo;

      // c. Order kaydı oluştur. managedStatus=awaiting_admin → admin sipariş havuzuna düşer.
      //    Eşzamanlı poll (concurrency>1) aynı siparişi aynı anda yakalayabilir; bu yüzden
      //    findFirst guard'a EK olarak (userId, ebayOrderId) benzersiz kısıtı vardır. Yarış
      //    durumunda ikinci create P2002 fırlatır → ikinci satır OLUŞMAZ, atlanır.
      let order: { id: string };
      try {
        order = await prisma.order.create({
          data: {
            userId: listing.userId,
            listingId: listing.id,
            ebayOrderId: ebayOrder.orderId,
            ebayLineItemId,
            soldPrice: Number.isFinite(soldPrice) ? soldPrice : null,
            fulfillmentStatus: "pending",
            managedStatus: "awaiting_admin",
            // Alıcı adresi (PII — sadece admin görür)
            shipToName: ship?.name ?? null,
            shipToLine1: ship?.line1 ?? null,
            shipToLine2: ship?.line2 ?? null,
            shipToCity: ship?.city ?? null,
            shipToState: ship?.state ?? null,
            shipToZip: ship?.zip ?? null,
            shipToCountry: ship?.country ?? null,
            shipToPhone: ship?.phone ?? null,
          },
          select: { id: true },
        });
      } catch (createErr) {
        // Benzersiz kısıt ihlali (userId, ebayOrderId) → bu sipariş zaten var. Çift değil.
        if (
          createErr instanceof Prisma.PrismaClientKnownRequestError &&
          createErr.code === "P2002"
        ) {
          skippedExisting++;
          continue;
        }
        throw createErr;
      }

      // d. Satış sinyali: ürünü "son satış"la işaretle + sık taramaya (hot) al.
      //    Satan ürün = canlı talep = oversell riski en yüksek → yakından izle.
      await prisma.product
        .update({
          where: { id: listing.productId },
          data: { lastSoldAt: new Date(), pollTier: "hot" },
        })
        .catch(() => {});

      // e. verify-order kuyruğuna ekle.
      await verifyOrderQueue.add("verify-order", { orderId: order.id });

      createdCount++;
    } catch (err) {
      // Tek siparişin hatası diğerlerini durdurmaz — token/secret loglanmaz.
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[poll-orders] Sipariş işleme hatası: ebayOrder=${ebayOrder.orderId} | ${errMsg}`
      );
    }
  }

  // 4. Özet logla.
  await job.log(
    `Tamamlandı: oluşturulan=${createdCount} | mevcut=${skippedExisting} | listingsiz=${skippedNoListing}`
  );
}

export function createPollOrdersWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<PollOrdersJobData>(
    "poll-orders",
    processPollOrders,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(
      `[poll-orders] ✓ Job tamamlandı: ${job.id} | account: ${job.data.ebayAccountId}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[poll-orders] ✗ Job başarısız: ${job?.id} | account: ${job?.data.ebayAccountId} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[poll-orders] Worker hatası:", err);
  });

  return worker;
}
