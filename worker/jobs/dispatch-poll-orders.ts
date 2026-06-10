// dispatch-poll-orders worker — tüm aktif eBay hesaplarını poll-orders kuyruğuna ekler.
// Her 30 dakikada bir çalışır (scheduler tarafından tetiklenir).
//
// Koşul: refreshTokenEncrypted dolu olan tüm hesaplar alınır.
// jobId ile duplicate koruması uygulanır.
//
// Güvenlik: hiçbir token/secret loglanmaz.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { pollOrdersQueue } from "@/lib/queues";
import type { DispatchPollOrdersJobData } from "@/lib/queues";

async function processDispatchPollOrders(
  job: Job<DispatchPollOrdersJobData>
): Promise<void> {
  // refreshTokenEncrypted dolu olan tüm eBay hesaplarını al
  const accounts = await prisma.ebayAccount.findMany({
    where: {
      refreshTokenEncrypted: { not: null },
    },
    select: { id: true, ebayUserId: true },
  });

  await job.log(`${accounts.length} aktif eBay hesabı bulundu`);

  let queued = 0;
  let skipped = 0;

  for (const account of accounts) {
    try {
      await pollOrdersQueue.add(
        "poll-orders",
        { ebayAccountId: account.id },
        {
          jobId: `poll-orders:${account.id}`,
        }
      );
      queued++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!errMsg.includes("already exists") && !errMsg.includes("duplicate")) {
        console.error(
          `[dispatch-poll-orders] Kuyruğa ekleme hatası: account=${account.id} | ${errMsg}`
        );
      }
      skipped++;
    }
  }

  await job.log(
    `Tamamlandı: kuyruğa eklenen=${queued} | atlanan(duplicate)=${skipped}`
  );

  console.log(
    `[dispatch-poll-orders] Tamamlandı: kuyruğa eklenen=${queued} | atlanan=${skipped}`
  );
}

export function createDispatchPollOrdersWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DispatchPollOrdersJobData>(
    "dispatch-poll-orders",
    processDispatchPollOrders,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => {
    console.log(`[dispatch-poll-orders] ✓ Job tamamlandı: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[dispatch-poll-orders] ✗ Job başarısız: ${job?.id} | Hata: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[dispatch-poll-orders] Worker hatası:", err);
  });

  return worker;
}
