// dispatch-amazon-polls worker — Amazon tarafının stok takibinin kalbi. Her 5 dakikada bir çalışır.
// eBay'deki dispatch-polls.ts'in birebir Amazon karşılığı, aynı 3 görev:
//   1) BAYAT-VERİ KORUMASI: uzun süredir taranamayan AKTİF ürünleri güvenlik için
//      duraklat (Amazon'a qty 0) → oversell önle.
//   2) NORMAL TARAMA: aktif ürünleri tier'a göre amazon-poll-product'a gönder.
//        hot 15dk / normal 2sa / dead 12sa
//   3) AUTO-RECOVERY: duraklatılmış ürünleri saatte bir yeniden değerlendir →
//      düzelmişse amazon-poll-product otomatik geri açar.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { amazonPollProductQueue, amazonUpdateListingQueue } from "@/lib/queues";
import { chunk, QUEUE_CHUNK } from "@/lib/batch";
import type { DispatchAmazonPollsJobData, AmazonPollProductJobData } from "@/lib/queues";

// "Takibe değer" listing — stok kontrol SADECE yüklenmiş/yayın hattındaki ürünler
// için çalışır (eBay'deki TRACKABLE_LISTING ile aynı mantık).
const TRACKABLE_AMAZON_LISTING: Prisma.AmazonListingWhereInput = {
  OR: [
    { asin: { not: null }, status: { not: "ended" } },
    { status: "active" },
    { status: "paused", lastError: null, amazonAccount: { isActive: true } },
  ],
};

const TIER_THRESHOLDS_MS = {
  hot: 15 * 60 * 1000,        // 15 dakika
  normal: 2 * 60 * 60 * 1000, // 2 saat
  dead: 12 * 60 * 60 * 1000,  // 12 saat
} as const;

const TIER_BUDGET = { hot: 600, normal: 300, dead: 100 } as const;

const STALE_MS = 6 * 60 * 60 * 1000; // 6 saat
const STALE_MAX_PER_RUN = 300;

const RECOVERY_MS = 60 * 60 * 1000; // 1 saat
const RECOVERY_BUDGET = 150;

// ── 1) Bayat-veri koruması ──────────────────────────────────────────────────
async function guardStaleProducts(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_MS);
  const stale = await prisma.amazonDepotProduct.findMany({
    where: {
      status: "active",
      lastScrapedAt: { lt: cutoff },
      listings: { some: TRACKABLE_AMAZON_LISTING },
    },
    select: { id: true, aliId: true },
    take: STALE_MAX_PER_RUN,
  });
  if (stale.length === 0) return 0;

  const ids = stale.map((p) => p.id);

  const listings = await prisma.amazonListing.findMany({
    where: { productId: { in: ids }, status: "active" },
    select: { id: true, salePrice: true },
  });

  // SIRA KRİTİK: ÖNCE Amazon'u güvene al (qty 0 Redis'te kalıcı), SONRA DB'yi paused yap.
  const pauseJobs = listings.map((l) => ({
    name: "amazon-update-listing" as const,
    data: { listingId: l.id, price: l.salePrice ?? 0, qty: 0 },
    opts: { jobId: `pause-amazon-listing:${l.id}` },
  }));
  for (const part of chunk(pauseJobs, QUEUE_CHUNK)) {
    await amazonUpdateListingQueue.addBulk(part);
  }

  await prisma.amazonDepotProduct.updateMany({
    where: { id: { in: ids } },
    data: { status: "paused" },
  });
  await prisma.amazonListing.updateMany({
    where: { productId: { in: ids }, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });

  return stale.length;
}

// ── 2) Normal tarama (tier'a göre) ──────────────────────────────────────────
async function dispatchActive(now: Date): Promise<number> {
  const jobs: { name: "amazon-poll-product"; data: AmazonPollProductJobData; opts: { jobId: string } }[] = [];
  for (const [tier, thresholdMs] of Object.entries(TIER_THRESHOLDS_MS)) {
    const budget = TIER_BUDGET[tier as keyof typeof TIER_BUDGET];
    const cutoff = new Date(now.getTime() - thresholdMs);

    const products = await prisma.amazonDepotProduct.findMany({
      where: {
        status: "active",
        pollTier: tier,
        OR: [{ lastScrapedAt: null }, { lastScrapedAt: { lt: cutoff } }],
        listings: { some: TRACKABLE_AMAZON_LISTING },
      },
      select: { id: true },
      take: budget,
      orderBy: { lastScrapedAt: { sort: "asc", nulls: "first" } },
    });

    for (const p of products) {
      jobs.push({
        name: "amazon-poll-product",
        data: { depotProductId: p.id },
        opts: { jobId: `amazon-poll-product:${p.id}` },
      });
    }
  }
  for (const part of chunk(jobs, QUEUE_CHUNK)) {
    await amazonPollProductQueue.addBulk(part);
  }
  return jobs.length;
}

// ── 3) Auto-recovery (duraklatılmış ürünler) ────────────────────────────────
async function dispatchRecovery(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RECOVERY_MS);
  const products = await prisma.amazonDepotProduct.findMany({
    where: {
      status: "paused",
      OR: [{ lastScrapedAt: null }, { lastScrapedAt: { lt: cutoff } }],
      listings: { some: TRACKABLE_AMAZON_LISTING },
    },
    select: { id: true },
    take: RECOVERY_BUDGET,
    orderBy: { lastScrapedAt: { sort: "asc", nulls: "first" } },
  });

  const jobs = products.map((p) => ({
    name: "amazon-poll-product" as const,
    data: { depotProductId: p.id } as AmazonPollProductJobData,
    opts: { jobId: `amazon-poll-product:${p.id}` },
  }));
  for (const part of chunk(jobs, QUEUE_CHUNK)) {
    await amazonPollProductQueue.addBulk(part);
  }
  return jobs.length;
}

async function processDispatchAmazonPolls(job: Job<DispatchAmazonPollsJobData>): Promise<void> {
  const now = new Date();

  const staled = await guardStaleProducts(now);
  const active = await dispatchActive(now);
  const recovered = await dispatchRecovery(now);

  await job.log(`bayat-duraklatma=${staled} | normal-tarama=${active} | recovery=${recovered}`);
  console.log(`[dispatch-amazon-polls] bayat=${staled} | tarama=${active} | recovery=${recovered}`);
}

export function createDispatchAmazonPollsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DispatchAmazonPollsJobData>(
    "dispatch-amazon-polls",
    processDispatchAmazonPolls,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[dispatch-amazon-polls] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[dispatch-amazon-polls] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[dispatch-amazon-polls] Worker hatası:", err));

  return worker;
}
