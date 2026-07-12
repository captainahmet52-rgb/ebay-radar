// amazon-update-listing worker — SP-API Listings ile fiyat/stok gönderir (repricing + oversell koruması).
// eBay'deki update-listing.ts'in Amazon karşılığı (legacy dal yok, Amazon'da tek yayın yolu var).
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { createOrUpdateAmazonListing } from "@/lib/amazon-listings";
import type { AmazonUpdateListingJobData } from "@/lib/queues";

async function processAmazonUpdateListing(job: Job<AmazonUpdateListingJobData>): Promise<void> {
  const { listingId, price, qty } = job.data;

  const listing = await prisma.amazonListing.findUnique({
    where: { id: listingId },
    include: { amazonAccount: true, product: true },
  });

  if (!listing) throw new Error(`AmazonListing bulunamadı: ${listingId}`);
  if (listing.status === "ended") {
    job.log(`Listing sonlandırılmış — güncelleme atlandı: ${listingId}`);
    return;
  }
  if (!listing.amazonAccount.spapiRefreshTokenEncrypted) {
    job.log(`Hesabın SP-API token'ı yok — atlandı: ${listingId}`);
    return;
  }

  try {
    const result = await createOrUpdateAmazonListing(
      listing.amazonAccount,
      listing.product,
      price,
      qty,
      listing.asin
    );

    await prisma.amazonListing.update({
      where: { id: listingId },
      data: {
        salePrice: price,
        currentQty: qty,
        status: qty === 0 ? "paused" : "active",
        lastError: null,
      },
    });

    job.log(`Tamamlandı: listing=${listingId} | SKU=${result.sku} | $${price.toFixed(2)} | Qty=${qty}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.amazonListing
      .update({ where: { id: listingId }, data: { lastError: errMsg } })
      .catch(() => {});
    throw err; // BullMQ retry (geçici hatalar için)
  }
}

export function createAmazonUpdateListingWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonUpdateListingJobData>(
    "amazon-update-listing",
    processAmazonUpdateListing,
    {
      connection,
      concurrency: 4,
      // SP-API rate limit koruması (eBay'deki update-listing ile aynı desen)
      limiter: { max: 10, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-update-listing] ✓ ${job.id} | ${job.data.listingId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-update-listing] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-update-listing] worker hatası:", err));

  return worker;
}
