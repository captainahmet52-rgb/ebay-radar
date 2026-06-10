// dispatch-polls worker — aktif ürünleri tier'a göre poll-product kuyruğuna ekler.
// Her 5 dakikada bir çalışır (scheduler tarafından tetiklenir).
//
// Tier süresi:
//   hot    → 15 dakikadan eskiyse ekle
//   normal → 2 saatten eskiyse ekle
//   dead   → 12 saatten eskiyse ekle
//
// Güvenlik: hiçbir token/secret loglanmaz.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { pollProductQueue } from "@/lib/queues";
import type { DispatchPollsJobData } from "@/lib/queues";

const TIER_THRESHOLDS_MS = {
  hot: 15 * 60 * 1000,        // 15 dakika
  normal: 2 * 60 * 60 * 1000, // 2 saat
  dead: 12 * 60 * 60 * 1000,  // 12 saat
} as const;

const MAX_PER_RUN = 200;

async function processDispatchPolls(job: Job<DispatchPollsJobData>): Promise<void> {
  const now = new Date();

  let totalQueued = 0;
  let totalSkipped = 0;

  for (const [tier, thresholdMs] of Object.entries(TIER_THRESHOLDS_MS)) {
    // Her tier için kalan kapasiteyi hesapla
    const remaining = MAX_PER_RUN - totalQueued;
    if (remaining <= 0) break;

    const cutoff = new Date(now.getTime() - thresholdMs);

    const products = await prisma.product.findMany({
      where: {
        status: "active",
        pollTier: tier,
        OR: [
          { lastScrapedAt: null },
          { lastScrapedAt: { lt: cutoff } },
        ],
      },
      select: { id: true, asin: true, lastScrapedAt: true },
      take: remaining,
    });

    for (const product of products) {
      try {
        // jobId ile duplicate koruması — aynı ürün zaten kuyruktaysa eklenmez
        await pollProductQueue.add(
          "poll-product",
          { productId: product.id },
          {
            jobId: `poll-product:${product.id}`,
            // Mevcut job'ı ezme — sadece yoksa ekle
          }
        );
        totalQueued++;
      } catch (err) {
        // "Job already exists" hatası normal — duplicate koruması çalışıyor
        const errMsg = err instanceof Error ? err.message : String(err);
        if (!errMsg.includes("already exists") && !errMsg.includes("duplicate")) {
          console.error(`[dispatch-polls] Kuyruğa ekleme hatası: product=${product.id} | ${errMsg}`);
        }
        totalSkipped++;
      }
    }

    await job.log(
      `Tier=${tier}: ${products.length} ürün bulundu, cutoff=${cutoff.toISOString()}`
    );
  }

  await job.log(
    `Tamamlandı: kuyruğa eklenen=${totalQueued} | atlanan(duplicate)=${totalSkipped}`
  );

  console.log(
    `[dispatch-polls] Tamamlandı: kuyruğa eklenen=${totalQueued} | atlanan=${totalSkipped}`
  );
}

export function createDispatchPollsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DispatchPollsJobData>(
    "dispatch-polls",
    processDispatchPolls,
    { connection, concurrency: 1 } // Tek çalışsın — paralel dispatch istenmiyor
  );

  worker.on("completed", (job) => {
    console.log(`[dispatch-polls] ✓ Job tamamlandı: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[dispatch-polls] ✗ Job başarısız: ${job?.id} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[dispatch-polls] Worker hatası:", err);
  });

  return worker;
}
