// dispatch-radar worker — OTO-PİLOT. Taraması gelen aktif mağazaları radar-scan'e atar.
// Scheduler tarafından periyodik tetiklenir (her 30 dk). Her mağazanın scanIntervalHours'ına
// göre "due" olanlar staggered (kademeli) kuyruğa eklenir. ScrapingBee kredisini admin,
// mağaza başına scanIntervalHours ile kontrol eder (0 = kapalı).
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { radarScanQueue, type DispatchRadarJobData } from "@/lib/queues";
import { isStoreDue, scanBucket } from "@/lib/radar/schedule";

// Kademeli enqueue — eş zamanlı scrape patlamasını önler
const STAGGER_MS = 4000;

async function processDispatchRadar(job: Job<DispatchRadarJobData>): Promise<void> {
  const now = new Date();
  const stores = await prisma.trackedStore.findMany({ where: { isActive: true } });

  let dispatched = 0;
  let i = 0;
  for (const store of stores) {
    if (!isStoreDue({ scanIntervalHours: store.scanIntervalHours, lastScannedAt: store.lastScannedAt }, now)) {
      continue;
    }
    const bucket = scanBucket(store.scanIntervalHours, now);
    await radarScanQueue.add(
      "radar-scan",
      { trackedStoreId: store.id },
      // Stabil jobId → aynı pencerede çift tarama olmaz
      { jobId: `auto-radar:${store.id}:${bucket}`, delay: i * STAGGER_MS },
    );
    dispatched++;
    i++;
  }

  await job.log(`Oto-pilot: ${dispatched}/${stores.length} mağaza taramaya alındı`);
}

export function createDispatchRadarWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DispatchRadarJobData>("dispatch-radar", processDispatchRadar, {
    connection,
    concurrency: 1,
  });
  worker.on("failed", (job, err) => console.error(`[dispatch-radar] ✗ ${job?.id} | ${err.message}`));
  worker.on("error", (err) => console.error("[dispatch-radar] worker hatası:", err));
  return worker;
}
