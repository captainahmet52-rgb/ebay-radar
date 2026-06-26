// verify-import-match worker — tek ImportedListing'i Amazon'dan doğrula (SIFIR HATA).
// SCRAPER MALİYETİ burada. Kota biterse admin'e bildir + job retry (review'a düşürme).
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { verifyMatch } from "@/lib/ebay/listing-import";
import { ScraperOutOfCreditsError } from "@/lib/scraper";
import { notifyScraperOutOfCredits } from "@/lib/admin-notify";
import { type VerifyImportMatchJobData } from "@/lib/queues";

async function processVerifyImportMatch(job: Job<VerifyImportMatchJobData>): Promise<void> {
  const { importedListingId } = job.data;
  try {
    await verifyMatch(importedListingId);
  } catch (err) {
    if (err instanceof ScraperOutOfCreditsError) {
      await notifyScraperOutOfCredits("ilan eşleştirme doğrulaması").catch(() => {});
    }
    throw err; // BullMQ retry etsin (geçici scraper hatası)
  }
}

export function createVerifyImportMatchWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<VerifyImportMatchJobData>(
    "verify-import-match",
    processVerifyImportMatch,
    {
      connection,
      concurrency: 3,
      // Scraper'ı boğmamak için hız limiti (poll-product ile kotayı paylaşır)
      limiter: { max: 10, duration: 1000 },
    }
  );

  worker.on("completed", (job) => {
    console.log(`[verify-import-match] ✓ ${job.id} | ${job.data.importedListingId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[verify-import-match] ✗ ${job?.id} | ${job?.data.importedListingId} | ${err.message}`);
  });
  worker.on("error", (err) => {
    console.error(`[verify-import-match] Worker hatası:`, err);
  });

  return worker;
}
