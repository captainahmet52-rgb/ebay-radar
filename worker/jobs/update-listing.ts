// update-listing worker — eBay Inventory API ile listing fiyat/stok güncelleme
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getValidToken } from "@/lib/ebay/oauth";
import { pauseListing, updatePriceAndQty } from "@/lib/ebay/inventory";
import type { UpdateListingJobData } from "@/lib/queues";

// ─── Job işleyici ─────────────────────────────────────────────────────────────
async function processUpdateListing(
  job: Job<UpdateListingJobData>
): Promise<void> {
  const { listingId, price, qty } = job.data;

  // 1. Listing + EbayAccount + Product çek
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      ebayAccount: true,
      product: true,
    },
  });

  if (!listing) {
    throw new Error(`Listing bulunamadı: ${listingId}`);
  }

  if (listing.status === "ended") {
    job.log(`Listing sonlandırılmış — güncelleme atlandı: ${listingId}`);
    return;
  }

  if (!listing.ebayListingId) {
    job.log(
      `ebayListingId yok — listing henüz eBay'de oluşturulmamış: ${listingId}`
    );
    return;
  }

  const { ebayAccount, product } = listing;

  if (!ebayAccount.oauthTokenEncrypted) {
    throw new Error(`EbayAccount'ta OAuth token yok: ${ebayAccount.id}`);
  }

  // 2. Token sağlığını önceden doğrula (süresi dolduysa otomatik yenile).
  //    getValidToken hata verirse listing'i duraklat ve retry'siz çık.
  try {
    await getValidToken(ebayAccount.id);
  } catch (tokenErr) {
    const errMsg =
      tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
    console.error(
      `[update-listing] Token hatası — listing duraklatıldı: ${listingId} | ${errMsg}`
    );

    await prisma.listing.update({
      where: { id: listingId },
      data: { status: "paused", lastEbayError: errMsg },
    });

    // Token hatası retry edilemez — throw etme, sadece log
    return;
  }

  // bulk_update_price_quantity SKU (stok) + offerId (fiyat) gerektirir.
  const sku = listing.ebaySku ?? `EBAY-${product.asin}`;

  // 3. eBay'de fiyat + stok güncelle. offerId yoksa sadece stok güncellenebilir;
  //    bu durumda pauseListing/updatePriceAndQty yerine duraklat sinyali ver.
  try {
    if (qty === 0) {
      // Stok 0 → listing'i duraklat (qty 0). offerId gerekmez.
      await pauseListing(ebayAccount.id, sku);
    } else if (listing.ebayOfferId) {
      // Tam güncelleme: stok + fiyat birlikte.
      await updatePriceAndQty(
        ebayAccount.id,
        sku,
        listing.ebayOfferId,
        price,
        qty
      );
    } else {
      // offerId yok — listing henüz publish edilmemiş olabilir.
      job.log(
        `ebayOfferId yok — fiyat/stok güncellemesi atlandı: ${listingId}`
      );
      return;
    }
  } catch (updateErr) {
    const errMsg =
      updateErr instanceof Error ? updateErr.message : String(updateErr);
    await prisma.listing.update({
      where: { id: listingId },
      data: { lastEbayError: errMsg },
    });
    // BullMQ retry yapsın diye hatayı yeniden fırlat.
    throw updateErr;
  }

  // 4. DB güncelle
  const now = new Date();
  const newStatus = qty === 0 ? "paused" : "active";

  await prisma.listing.update({
    where: { id: listingId },
    data: {
      currentPrice: price,
      currentQty: qty,
      status: newStatus,
      lastEbayError: null,
      updatedAt: now,
    },
  });

  job.log(
    `Tamamlandı: listing=${listingId} | SKU=${sku} | Fiyat=$${price.toFixed(2)} | Qty=${qty} | Status=${newStatus}`
  );
}

// ─── Worker factory ────────────────────────────────────────────────────────────
export function createUpdateListingWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<UpdateListingJobData>(
    "update-listing",
    processUpdateListing,
    {
      connection,
      concurrency: 4,
      // eBay API rate limit koruması
      limiter: {
        max: 10,
        duration: 1000, // saniyede max 10 listing güncelleme
      },
    }
  );

  worker.on("completed", (job) => {
    console.log(
      `[update-listing] ✓ Job tamamlandı: ${job.id} | listingId: ${job.data.listingId}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[update-listing] ✗ Job başarısız: ${job?.id} | listingId: ${job?.data.listingId} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error(`[update-listing] Worker hatası:`, err);
  });

  return worker;
}
