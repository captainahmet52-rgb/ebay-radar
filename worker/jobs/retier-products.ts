// retier-products worker — satış-hızına göre tarama grubunu (pollTier) ayarlar.
// Günde bir çalışır. Amaç: scraper masrafını satan ürünlere yönlendir.
//
//   son 7 günde satan          → hot   (sık tara, oversell riski en düşük)
//   7-30 gün önce satan         → normal
//   30+ gündür satmıyor + bol stok + eski ürün → dead (seyrek tara)
//
// Kurallar: yalnız AKTİF ürünler; AZ STOKLU ürün asla hot'tan düşürülmez
// (onu poll-product zaten hot'ta tutar). Yeni ürünlere 30 gün tanınır.
// Ayrıca 30 günden eski StockSnapshot kayıtları temizlenir.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import type { RetierProductsJobData } from "@/lib/queues";

const DAY = 24 * 60 * 60 * 1000;
const HOT_DAYS = 7;
const NORMAL_DAYS = 30;
const SNAPSHOT_RETENTION_DAYS = 30;

async function processRetier(job: Job<RetierProductsJobData>): Promise<void> {
  const now = Date.now();
  const d7 = new Date(now - HOT_DAYS * DAY);
  const d30 = new Date(now - NORMAL_DAYS * DAY);

  // 1) hot: son 7 günde satan
  const hot = await prisma.product.updateMany({
    where: { status: "active", lastSoldAt: { gte: d7 }, pollTier: { not: "hot" } },
    data: { pollTier: "hot" },
  });

  // 2) normal: 7-30 gün önce satan, az stoklu DEĞİL
  const normal = await prisma.product.updateMany({
    where: {
      status: "active",
      lastSoldAt: { lt: d7, gte: d30 },
      amazonStockStatus: { not: "low" },
      pollTier: { not: "normal" },
    },
    data: { pollTier: "normal" },
  });

  // 3) dead: 30+ gündür satmıyor (ya da hiç), bol stok, eski ürün, az stoklu DEĞİL
  const dead = await prisma.product.updateMany({
    where: {
      status: "active",
      amazonStockStatus: "in_stock",
      pollTier: { not: "dead" },
      createdAt: { lt: d30 }, // yeni ürünlere zaman tanı
      OR: [{ lastSoldAt: null }, { lastSoldAt: { lt: d30 } }],
    },
    data: { pollTier: "dead" },
  });

  // 4) Eski snapshot temizliği
  const pruned = await prisma.stockSnapshot.deleteMany({
    where: { createdAt: { lt: new Date(now - SNAPSHOT_RETENTION_DAYS * DAY) } },
  });

  await job.log(
    `hot=${hot.count} normal=${normal.count} dead=${dead.count} | snapshot-temizlenen=${pruned.count}`
  );
  console.log(
    `[retier-products] hot=${hot.count} normal=${normal.count} dead=${dead.count} pruned=${pruned.count}`
  );
}

export function createRetierProductsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<RetierProductsJobData>("retier-products", processRetier, {
    connection,
    concurrency: 1,
  });
  worker.on("completed", (job) => console.log(`[retier-products] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[retier-products] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[retier-products] Worker hatası:", err));
  return worker;
}
