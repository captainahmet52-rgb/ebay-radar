// publish-listing worker — yeni bir listing'i eBay'e API ile YAYINLAR.
// publishListing() aşamalıdır (inventory_item → offer → publish) ve idempotenttir:
// yarıda kalırsa bir sonraki denemede kaldığı aşamadan devam eder.
// Hata olursa publishListing zaten listing.lastEbayError'a yazar; panelde "yüklenmedi"
// olarak görünür. BullMQ birkaç kez retry eder (geçici eBay/token hataları için).
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { publishListing } from "@/lib/ebay/inventory";
import type { PublishListingJobData } from "@/lib/queues";

async function processPublishListing(job: Job<PublishListingJobData>): Promise<void> {
  const { listingId, ebayAccountId } = job.data;
  const result = await publishListing(ebayAccountId, listingId);
  await job.log(
    `Yayınlandı: listing=${listingId} → eBay listingId=${result.listingId} (SKU=${result.sku})`
  );
}

export function createPublishListingWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<PublishListingJobData>(
    "publish-listing",
    processPublishListing,
    {
      connection,
      concurrency: 3,
      // eBay API rate limit koruması
      limiter: { max: 5, duration: 1000 },
    }
  );

  worker.on("completed", (job) =>
    console.log(`[publish-listing] ✓ ${job.id} | listing: ${job.data.listingId}`)
  );
  worker.on("failed", (job, err) =>
    console.error(
      `[publish-listing] ✗ ${job?.id} | listing: ${job?.data.listingId} | ${err.message}`
    )
  );
  worker.on("error", (err) => console.error("[publish-listing] worker hatası:", err));

  return worker;
}
