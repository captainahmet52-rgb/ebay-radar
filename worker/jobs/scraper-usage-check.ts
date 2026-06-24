// scraper-usage-check worker — ScrapingBee kota kullanımını izler.
// Kota %80'i geçince admin'e ÖN-UYARI düşer (kota bitmeden, sürpriz kesinti olmasın).
// Birkaç saatte bir çalışır.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { getScraperUsage } from "@/lib/scraper";
import { notifyScraperQuotaLow } from "@/lib/admin-notify";
import type { ScraperUsageCheckJobData } from "@/lib/queues";

const WARN_THRESHOLD = 0.8; // %80

async function processScraperUsageCheck(job: Job<ScraperUsageCheckJobData>): Promise<void> {
  let usage;
  try {
    usage = await getScraperUsage();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await job.log(`Kota okunamadı: ${msg}`);
    return; // okunamazsa sessiz geç (kota bitince zaten 402 alarmı var)
  }

  await job.log(`Kota: ${usage.used}/${usage.max} (%${Math.round(usage.pct * 100)})`);

  if (usage.pct >= WARN_THRESHOLD) {
    await notifyScraperQuotaLow(usage.used, usage.max, usage.pct).catch(() => {});
  }
}

export function createScraperUsageCheckWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<ScraperUsageCheckJobData>(
    "scraper-usage-check",
    processScraperUsageCheck,
    { connection, concurrency: 1 }
  );
  worker.on("completed", (job) => console.log(`[scraper-usage-check] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[scraper-usage-check] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[scraper-usage-check] Worker hatası:", err));
  return worker;
}
