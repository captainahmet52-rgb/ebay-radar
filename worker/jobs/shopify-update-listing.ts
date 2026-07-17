// shopify-update-listing worker — Shopify Admin API ile fiyat/stok senkronu.
// amazon-update-listing'in Shopify karşılığı. Ortak depo deseni: AliExpress
// taraması (amazon-poll-product) fiyat/stok değişimi görünce bu kuyruğa da
// job bırakır; ürün hangi kanala yüklüyse orada güncellenir.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import {
  createShopifyProduct,
  updateShopifyListing,
  setShopifyProductStatus,
} from "@/lib/shopify/products";
import type { ShopifyUpdateListingJobData } from "@/lib/queues";

async function processShopifyUpdateListing(job: Job<ShopifyUpdateListingJobData>): Promise<void> {
  const { listingId, price, qty, pause } = job.data;

  const listing = await prisma.shopifyListing.findUnique({
    where: { id: listingId },
    include: { shopifyAccount: true, product: true },
  });

  if (!listing) throw new Error(`ShopifyListing bulunamadı: ${listingId}`);
  if (listing.status === "ended") {
    job.log(`Listing sonlandırılmış — atlandı: ${listingId}`);
    return;
  }
  if (!listing.shopifyAccount.accessTokenEncrypted) {
    job.log(`Hesabın access token'ı yok — atlandı: ${listingId}`);
    return;
  }

  const shopDomain = listing.shopifyAccount.shopDomain;
  const token = decryptToken(listing.shopifyAccount.accessTokenEncrypted);

  try {
    if (!listing.shopifyProductId || !listing.shopifyVariantId || !listing.inventoryItemId) {
      // İlk yükleme: Shopify'da ürünü oluştur
      const ids = await createShopifyProduct(shopDomain, token, {
        title: listing.product.title ?? `AliExpress Ürünü ${listing.product.aliId}`,
        imageUrl: listing.product.imageUrl,
        price,
        qty,
      });
      await prisma.shopifyListing.update({
        where: { id: listingId },
        data: {
          shopifyProductId: ids.productId,
          shopifyVariantId: ids.variantId,
          inventoryItemId: ids.inventoryItemId,
          salePrice: price,
          currentQty: qty,
          status: "active",
          lastError: null,
        },
      });
      job.log(`Oluşturuldu: listing=${listingId} | ${ids.productId} | $${price.toFixed(2)} | Qty=${qty}`);
      return;
    }

    const ids = {
      productId: listing.shopifyProductId,
      variantId: listing.shopifyVariantId,
      inventoryItemId: listing.inventoryItemId,
    };

    if (pause) {
      // Oversell koruması: vitrinden kaldır + adet 0
      await setShopifyProductStatus(shopDomain, token, ids.productId, "DRAFT");
      await updateShopifyListing(shopDomain, token, ids, price, 0);
      await prisma.shopifyListing.update({
        where: { id: listingId },
        data: { currentQty: 0, status: "paused", lastError: null },
      });
      job.log(`Duraklatıldı (DRAFT + qty 0): listing=${listingId}`);
      return;
    }

    // Normal senkron: fiyat + adet; ürün duraklatılmışsa yeniden vitrine aç
    if (listing.status === "paused") {
      await setShopifyProductStatus(shopDomain, token, ids.productId, "ACTIVE");
    }
    await updateShopifyListing(shopDomain, token, ids, price, qty);
    await prisma.shopifyListing.update({
      where: { id: listingId },
      data: { salePrice: price, currentQty: qty, status: qty === 0 ? "paused" : "active", lastError: null },
    });
    job.log(`Güncellendi: listing=${listingId} | $${price.toFixed(2)} | Qty=${qty}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.shopifyListing
      .update({ where: { id: listingId }, data: { lastError: errMsg } })
      .catch(() => {});
    throw err; // BullMQ retry (geçici hatalar için)
  }
}

export function createShopifyUpdateListingWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<ShopifyUpdateListingJobData>(
    "shopify-update-listing",
    processShopifyUpdateListing,
    {
      connection,
      concurrency: 4,
      // Shopify GraphQL maliyet limiti koruması
      limiter: { max: 4, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[shopify-update-listing] ✓ ${job.id} | ${job.data.listingId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[shopify-update-listing] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[shopify-update-listing] worker hatası:", err));

  return worker;
}
