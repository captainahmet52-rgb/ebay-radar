// Dağıtım worker — depodan kullanıcılara günlük limit kadar ürün dağıt
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import type { DistributeProductsJobData } from "@/lib/queues";

async function processDistributeProducts(
  job: Job<DistributeProductsJobData>
): Promise<void> {
  const { userId } = job.data;

  // Hedef kullanıcıları belirle
  const users = userId
    ? await prisma.user.findMany({ where: { id: userId } })
    : await prisma.user.findMany({ where: { plan: { not: "free" } } });

  for (const user of users) {
    // Kullanıcının mevcut dağıtım sayısını hesapla
    const distributedCount = await prisma.productDistribution.count({
      where: { userId: user.id },
    });

    const remaining = user.productLimit - distributedCount;
    if (remaining <= 0) {
      await job.log(`Kullanıcı ${user.id} limiti dolu (${user.productLimit})`);
      continue;
    }

    // Günlük dağıtım: aylık limiti 30'a böl (en az 1)
    const dailyQuota = Math.max(1, Math.ceil(user.productLimit / 30));
    const toDistribute = Math.min(dailyQuota, remaining);

    // Henüz bu kullanıcıya dağıtılmamış aktif depo ürünlerini al.
    // SIRA (P5 para motoru): önce en yüksek rankScore (kâr × talep × rekabetçilik),
    // eşitlikte en yeni. Böylece kullanıcı önce EN ÇOK SATAN + EN KÂRLI ürünleri alır.
    const availableProducts = await prisma.depotProduct.findMany({
      where: {
        status: "active",
        amazonPrice: { not: null, gte: 15 },
        distributions: {
          none: { userId: user.id },
        },
      },
      take: toDistribute,
      orderBy: [{ rankScore: "desc" }, { createdAt: "desc" }],
    });

    if (availableProducts.length === 0) {
      await job.log(`Kullanıcı ${user.id} için depoda ürün kalmadı`);
      continue;
    }

    for (const product of availableProducts) {
      await prisma.productDistribution.create({
        data: {
          userId: user.id,
          depotProductId: product.id,
        },
      });
    }

    await job.log(`Kullanıcı ${user.id}: ${availableProducts.length} ürün dağıtıldı`);
  }
}

export function createDistributeProductsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DistributeProductsJobData>(
    "distribute-products",
    processDistributeProducts,
    { connection, concurrency: 2 }
  );

  worker.on("completed", job => {
    console.log(`[distribute] ✓ ${job.id}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[distribute] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", err => console.error("[distribute] worker hatası:", err));

  return worker;
}
