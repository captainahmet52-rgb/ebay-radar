// freeze-stores worker — süresi biten mağazaları otomatik dondurur.
// Deneme (trialEndsAt) veya ücretli (paidUntil) süre dolmuş ve hâlâ aktif olan
// mağazaları isActive=false yapar. Böylece otomasyon (yükleme/tarama) durur ve
// kullanıcıya "paket al" denir. Sadece dondurur — asla geri açmaz.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import type { FreezeStoresJobData } from "@/lib/queues";

async function processFreezeStores(job: Job<FreezeStoresJobData>): Promise<void> {
  const now = new Date();

  // Aktif ama erişim süresi dolmuş mağazalar:
  //   (paidUntil yok veya geçmiş) VE (trialEndsAt yok veya geçmiş)
  const result = await prisma.ebayAccount.updateMany({
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
    await job.log(`${result.count} mağaza donduruldu (süre doldu)`);
    console.log(`[freeze-stores] ${result.count} mağaza donduruldu`);
  }
}

export function createFreezeStoresWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<FreezeStoresJobData>(
    "freeze-stores",
    processFreezeStores,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[freeze-stores] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[freeze-stores] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[freeze-stores] worker hatası:", err));

  return worker;
}
