// dispatch-polls worker — stok takibinin kalbi. Her 5 dakikada bir çalışır.
//
// 3 görev yapar:
//   1) BAYAT-VERİ KORUMASI: çok uzun süredir taranamayan AKTİF ürünleri güvenlik için
//      duraklat (eBay'e qty 0) → oversell önle.
//   2) NORMAL TARAMA: aktif ürünleri tier'a göre poll-product'a gönder.
//        hot 15dk / normal 2sa / dead 12sa
//   3) AUTO-RECOVERY: stok/fiyat kaynaklı DURAKLATILMIŞ ürünleri saatte bir yeniden
//      değerlendir → düzelmişse poll-product otomatik geri açar.
//
// Güvenlik: hiçbir token/secret loglanmaz.

import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { pollProductQueue, updateListingQueue } from "@/lib/queues";
import { notifyScraperFailing } from "@/lib/admin-notify";
import type { DispatchPollsJobData } from "@/lib/queues";

// "Takibe değer" listing — stok kontrol SADECE yüklenmiş/yayın hattındaki
// ürünler için çalışır. Hiç böyle listing'i olmayan ürün (yayına hiç çıkmamış,
// tüm listeleri kapatılmış ya da hatayla bloke = boşta duran) taranmaz →
// boşuna ScrapingBee kredisi yakılmaz.
const TRACKABLE_LISTING: Prisma.ListingWhereInput = {
  OR: [
    // eBay'de yayınlanmış ve kapatılmamış → oversell riski var, durumu ne olursa olsun izle
    { ebayListingId: { not: null }, status: { not: "ended" } },
    // Yayın hattında (aktif) → ilk yayın / fiyat-stok güncellemesi bu taramayla olur
    { status: "active" },
    // Stok sebebiyle duraklatılmış, eBay hatası yok, mağazası aktif → auto-recovery adayı
    { status: "paused", lastEbayError: null, ebayAccount: { isActive: true } },
  ],
};

const TIER_THRESHOLDS_MS = {
  hot: 15 * 60 * 1000,        // 15 dakika
  normal: 2 * 60 * 60 * 1000, // 2 saat
  dead: 12 * 60 * 60 * 1000,  // 12 saat
} as const;

// Tier başına tur bütçesi — hot ASLA aç kalmasın diye cömert; dead düşük.
const TIER_BUDGET = { hot: 600, normal: 300, dead: 100 } as const;

// Bayat-veri eşiği: aktif ama bu kadar süredir başarıyla taranamamış → güvenlik duraklatması.
const STALE_MS = 6 * 60 * 60 * 1000; // 6 saat
const STALE_MAX_PER_RUN = 300;

// Auto-recovery: duraklatılmış ürün bu kadar süre sonra yeniden denenir.
const RECOVERY_MS = 60 * 60 * 1000; // 1 saat
const RECOVERY_BUDGET = 150;
const RECOVERABLE_REASONS = ["out_of_stock", "low_stock", "price_spike", "floor", "stale"];

// ── 1) Bayat-veri koruması ──────────────────────────────────────────────────
async function guardStaleProducts(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - STALE_MS);
  const stale = await prisma.product.findMany({
    // listings-şartı olmadan boşta duran (artık taranmayan) ürünler burada
    // yanlış "tarama bozuk" alarmı üretirdi — onlar da kapsam dışı.
    where: {
      status: "active",
      lastScrapedAt: { lt: cutoff },
      listings: { some: TRACKABLE_LISTING },
    },
    select: { id: true, asin: true },
    take: STALE_MAX_PER_RUN,
  });
  if (stale.length === 0) return 0;

  const ids = stale.map((p) => p.id);

  // eBay'de yayında olan listing'leri qty 0'a çekmek için önce bul
  const listings = await prisma.listing.findMany({
    where: { productId: { in: ids }, status: "active" },
    select: { id: true, currentPrice: true, ebayListingId: true },
  });

  // SIRA KRİTİK: ÖNCE eBay'i güvene al (qty 0 işi Redis'te kalıcı), SONRA DB'yi
  // paused yap. Enqueue ile DB-update arasında çökersek ürün/listing "active"
  // kalır → sonraki tarama tekrar bu koruyu çalıştırır (jobId stable → idempotent).
  // Ters sırada (önce DB paused) çökersek eBay'de ürün satılabilir kalır VE re-run
  // status:active filtresine takılmaz = KALICI OVERSELL.
  await Promise.all(
    listings
      .filter((l) => l.ebayListingId)
      .map((l) =>
        updateListingQueue.add(
          "update-listing",
          { listingId: l.id, price: l.currentPrice ?? 0, qty: 0 },
          { jobId: `pause-listing:${l.id}` }
        )
      )
  );

  await prisma.product.updateMany({
    where: { id: { in: ids } },
    data: { status: "paused", pauseReason: "stale" },
  });
  await prisma.listing.updateMany({
    where: { productId: { in: ids }, status: "active" },
    data: { status: "paused", currentQty: 0 },
  });

  // Admin'e tek (dedup'lı) uyarı — tarama bozuk olabilir
  await notifyScraperFailing(stale[0].asin, `${stale.length} ürün 6+ saattir taranamadı`).catch(() => {});

  return stale.length;
}

// ── 2) Normal tarama (tier'a göre) ──────────────────────────────────────────
async function dispatchActive(now: Date): Promise<number> {
  let queued = 0;
  for (const [tier, thresholdMs] of Object.entries(TIER_THRESHOLDS_MS)) {
    const budget = TIER_BUDGET[tier as keyof typeof TIER_BUDGET];
    const cutoff = new Date(now.getTime() - thresholdMs);

    const products = await prisma.product.findMany({
      where: {
        status: "active",
        pollTier: tier,
        OR: [{ lastScrapedAt: null }, { lastScrapedAt: { lt: cutoff } }],
        listings: { some: TRACKABLE_LISTING },
      },
      select: { id: true },
      take: budget,
      orderBy: { lastScrapedAt: { sort: "asc", nulls: "first" } },
    });

    for (const p of products) {
      await pollProductQueue.add(
        "poll-product",
        { productId: p.id },
        { jobId: `poll-product:${p.id}` }
      );
      queued++;
    }
  }
  return queued;
}

// ── 3) Auto-recovery (duraklatılmış stok/fiyat ürünleri) ────────────────────
async function dispatchRecovery(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RECOVERY_MS);
  const products = await prisma.product.findMany({
    where: {
      status: "paused",
      pauseReason: { in: RECOVERABLE_REASONS },
      OR: [{ lastScrapedAt: null }, { lastScrapedAt: { lt: cutoff } }],
      listings: { some: TRACKABLE_LISTING },
    },
    select: { id: true },
    take: RECOVERY_BUDGET,
    orderBy: { lastScrapedAt: { sort: "asc", nulls: "first" } },
  });

  let queued = 0;
  for (const p of products) {
    await pollProductQueue.add(
      "poll-product",
      { productId: p.id, recovery: true },
      { jobId: `poll-product:${p.id}` }
    );
    queued++;
  }
  return queued;
}

async function processDispatchPolls(job: Job<DispatchPollsJobData>): Promise<void> {
  const now = new Date();

  const staled = await guardStaleProducts(now);
  const active = await dispatchActive(now);
  const recovered = await dispatchRecovery(now);

  await job.log(`bayat-duraklatma=${staled} | normal-tarama=${active} | recovery=${recovered}`);
  console.log(`[dispatch-polls] bayat=${staled} | tarama=${active} | recovery=${recovered}`);
}

export function createDispatchPollsWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<DispatchPollsJobData>("dispatch-polls", processDispatchPolls, {
    connection,
    concurrency: 1,
  });

  worker.on("completed", (job) => console.log(`[dispatch-polls] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[dispatch-polls] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[dispatch-polls] Worker hatası:", err));

  return worker;
}
