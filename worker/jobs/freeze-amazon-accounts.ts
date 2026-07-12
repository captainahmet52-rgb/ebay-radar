// freeze-amazon-accounts worker — freeze-stores'un (eBay) Amazon karşılığı.
// Deneme (trialEndsAt) veya ücretli (paidUntil) süresi dolmuş ve hâlâ aktif olan
// Amazon hesaplarını isActive=false yapar. Böylece oto-yükleme durur ve
// kullanıcıya "paket al" denir. Sadece dondurur — asla geri açmaz.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import type { FreezeAmazonAccountsJobData } from "@/lib/queues";

async function processFreezeAmazonAccounts(job: Job<FreezeAmazonAccountsJobData>): Promise<void> {
  const now = new Date();

  const result = await prisma.amazonAccount.updateMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ paidUntil: null }, { paidUntil: { lte: now } }] },
        { OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: now } }] },
      ],
    },
    data: { isActive: false },
  });

  if (result.count > 0) {
    await job.log(`${result.count} Amazon hesabı donduruldu (süre doldu)`);
    console.log(`[freeze-amazon-accounts] ${result.count} hesap donduruldu`);
  }
}

export function createFreezeAmazonAccountsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<FreezeAmazonAccountsJobData>(
    "freeze-amazon-accounts",
    processFreezeAmazonAccounts,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[freeze-amazon-accounts] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[freeze-amazon-accounts] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[freeze-amazon-accounts] worker hatası:", err));

  return worker;
}
