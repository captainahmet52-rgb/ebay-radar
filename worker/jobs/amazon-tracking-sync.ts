// AmazonBot takip senkronu — aliOrderId olup henüz kargo no'su olmayan siparişler için
// AliExpress'ten takip numarasını çeker. (Bu, Cainiao no'sudur; kullanıcı sonra 17track ile
// geçerli son-mil numaraya çevirir.) Scheduler tarafından 2 saatte bir çalışır.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { getAliExpressTracking, isAliExpressConfigured } from "@/lib/aliexpress";
import type { AmazonTrackingSyncJobData } from "@/lib/queues";

async function processTrackingSync(job: Job<AmazonTrackingSyncJobData>): Promise<void> {
  if (!isAliExpressConfigured()) {
    throw new Error("AliExpress bağlı değil — takip senkronu yapılamaz");
  }

  // AliExpress siparişi verilmiş ama henüz takip no'su gelmemiş siparişler
  const orders = await prisma.amazonOrder.findMany({
    where: { aliOrderId: { not: null }, aliTrackingNo: null },
    take: 100,
  });

  await job.log(`Takip beklenen sipariş: ${orders.length}`);

  for (const order of orders) {
    try {
      const { trackingNo } = await getAliExpressTracking(order.aliOrderId!);
      if (trackingNo) {
        await prisma.amazonOrder.update({
          where: { id: order.id },
          data: { aliTrackingNo: trackingNo, trackingStatus: "pending" },
        });
      }
    } catch (err) {
      await job.log(`Takip çekilemedi (${order.id}): ${err instanceof Error ? err.message : err}`);
    }
  }
}

export function createAmazonTrackingSyncWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonTrackingSyncJobData>(
    "amazon-tracking-sync",
    processTrackingSync,
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error(`[amazon-tracking-sync] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-tracking-sync] worker hatası:", err));

  return worker;
}
