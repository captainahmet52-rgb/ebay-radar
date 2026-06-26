// listing-import worker — satıcının MEVCUT eBay ilanlarını çek (keşif fazı).
// Trading API GetMyeBaySelling ile sayfalı çeker; scraper KULLANMAZ.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { runDiscovery } from "@/lib/ebay/listing-import";
import { type ListingImportJobData } from "@/lib/queues";

async function processListingImport(job: Job<ListingImportJobData>): Promise<void> {
  const { importId } = job.data;
  await job.log(`Keşif başlıyor: import ${importId}`);
  await runDiscovery(importId);
  await job.log(`Keşif tamamlandı: import ${importId}`);
}

export function createListingImportWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<ListingImportJobData>("listing-import", processListingImport, {
    connection,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[listing-import] ✓ ${job.id} | importId: ${job.data.importId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[listing-import] ✗ ${job?.id} | importId: ${job?.data.importId} | ${err.message}`);
  });
  worker.on("error", (err) => {
    console.error(`[listing-import] Worker hatası:`, err);
  });

  return worker;
}
