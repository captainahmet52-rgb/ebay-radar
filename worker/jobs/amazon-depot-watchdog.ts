// AmazonBot depo bekçisi — depodaki taze ürün eşik altına düşünce radarı HEMEN tetikler.
// Scheduler tarafından sık (her 15 dk) çalıştırılır; ürün bittiğinde anlık tepki için
// auto-upload ve poll-product da triggerRadarIfLow çağırır.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { triggerRadarIfLow } from "@/lib/amazon-depot";
import type { AmazonDepotWatchdogJobData } from "@/lib/queues";

async function processDepotWatchdog(job: Job<AmazonDepotWatchdogJobData>): Promise<void> {
  const { triggered, count } = await triggerRadarIfLow("bekçi turu");
  await job.log(`Depo taze ürün: ${count} — radar ${triggered ? "tetiklendi" : "gerek yok"}`);
}

export function createAmazonDepotWatchdogWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonDepotWatchdogJobData>(
    "amazon-depot-watchdog",
    processDepotWatchdog,
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[amazon-depot-watchdog] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-depot-watchdog] worker hatası:", err));

  return worker;
}
