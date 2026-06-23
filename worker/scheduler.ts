// Scheduler — BullMQ repeatable job'larını kurar.
// Worker başlayınca setupScheduler() bir kez çağrılır.
//
// Kurulan repeatable job'lar:
//   dispatch-polls        → her 5 dakikada bir
//   dispatch-poll-orders  → her 30 dakikada bir
//   refresh-tokens        → her 30 dakikada bir (tüm hesaplar)
//   distribute-products   → her gün 02:00 UTC (cron)
//
// Her çalıştırmada: önce mevcut repeatable job'lar temizlenir (duplicate önleme),
// sonra yeniden eklenir. Bu sayede deployment'ta ayarlar güncellenir.

import {
  dispatchPollsQueue,
  dispatchPollOrdersQueue,
  refreshTokensQueue,
  distributeProductsQueue,
  amazonRadarScanQueue,
  amazonAutoUploadQueue,
  amazonPollOrdersQueue,
  amazonDepotWatchdogQueue,
  amazonTrackingSyncQueue,
  freezeStoresQueue,
} from "@/lib/queues";

// AmazonBot radar — taranacak pazarlar
const AMAZON_RADAR_MARKETS = ["us", "uk", "ae", "sa"] as const;

export async function setupScheduler(): Promise<void> {
  // ── dispatch-polls: her 5 dakika ────────────────────────────────────────────
  await clearRepeatableJobs(dispatchPollsQueue, "dispatch-polls");
  await dispatchPollsQueue.add(
    "dispatch-polls",
    {},
    {
      repeat: { every: 5 * 60 * 1000 }, // 5 dakika (ms)
    }
  );
  console.log("[scheduler] dispatch-polls kuruldu: her 5 dakika");

  // ── dispatch-poll-orders: her 30 dakika ─────────────────────────────────────
  await clearRepeatableJobs(dispatchPollOrdersQueue, "dispatch-poll-orders");
  await dispatchPollOrdersQueue.add(
    "dispatch-poll-orders",
    {},
    {
      repeat: { every: 30 * 60 * 1000 }, // 30 dakika (ms)
    }
  );
  console.log("[scheduler] dispatch-poll-orders kuruldu: her 30 dakika");

  // ── refresh-tokens: her 30 dakika (tüm hesaplar) ─────────────────────────────
  await clearRepeatableJobs(refreshTokensQueue, "refresh-tokens");
  await refreshTokensQueue.add(
    "refresh-tokens",
    {}, // ebayAccountId undefined → tüm süresi yaklaşan hesaplar
    {
      repeat: { every: 30 * 60 * 1000 }, // 30 dakika (ms)
    }
  );
  console.log("[scheduler] refresh-tokens kuruldu: her 30 dakika");

  // ── distribute-products: her gün 02:00 UTC ───────────────────────────────────
  await clearRepeatableJobs(distributeProductsQueue, "distribute-products");
  await distributeProductsQueue.add(
    "distribute-products",
    {}, // userId undefined → tüm kullanıcılara dağıt
    {
      repeat: { pattern: "0 2 * * *" }, // cron: 02:00 UTC her gün
    }
  );
  console.log("[scheduler] distribute-products kuruldu: her gün 02:00 UTC");

  // ── amazon-radar-scan: her pazar için 6 saatte bir ──────────────────────────
  await clearRepeatableJobs(amazonRadarScanQueue, "amazon-radar-scan");
  for (const market of AMAZON_RADAR_MARKETS) {
    await amazonRadarScanQueue.add(
      "amazon-radar-scan",
      { market },
      {
        repeat: { every: 6 * 60 * 60 * 1000 }, // 6 saat (ms)
        jobId: `amazon-radar:${market}`, // pazar başına tek repeatable
      }
    );
  }
  console.log(
    `[scheduler] amazon-radar-scan kuruldu: ${AMAZON_RADAR_MARKETS.length} pazar, her 6 saat`
  );

  // ── amazon-auto-upload: her gün 03:00 UTC (oto-yükleme açık tüm kullanıcılar) ──
  await clearRepeatableJobs(amazonAutoUploadQueue, "amazon-auto-upload");
  await amazonAutoUploadQueue.add(
    "amazon-auto-upload",
    {}, // userId undefined → tüm açık kullanıcılar
    { repeat: { pattern: "0 3 * * *" } }
  );
  console.log("[scheduler] amazon-auto-upload kuruldu: her gün 03:00 UTC");

  // ── amazon-poll-orders: her 30 dakika (SP-API getOrders → Siparişlerim) ──────
  await clearRepeatableJobs(amazonPollOrdersQueue, "amazon-poll-orders");
  await amazonPollOrdersQueue.add(
    "amazon-poll-orders",
    {}, // tüm hesaplar
    { repeat: { every: 30 * 60 * 1000 } }
  );
  console.log("[scheduler] amazon-poll-orders kuruldu: her 30 dakika");

  // ── amazon-depot-watchdog: her 15 dakika (depo azalınca radarı hemen tetikler) ──
  await clearRepeatableJobs(amazonDepotWatchdogQueue, "amazon-depot-watchdog");
  await amazonDepotWatchdogQueue.add(
    "amazon-depot-watchdog",
    {},
    { repeat: { every: 15 * 60 * 1000 } }
  );
  console.log("[scheduler] amazon-depot-watchdog kuruldu: her 15 dakika");

  // ── amazon-tracking-sync: her 2 saat (AliExpress sipariş → kargo no) ─────────
  await clearRepeatableJobs(amazonTrackingSyncQueue, "amazon-tracking-sync");
  await amazonTrackingSyncQueue.add(
    "amazon-tracking-sync",
    {},
    { repeat: { every: 2 * 60 * 60 * 1000 } }
  );
  console.log("[scheduler] amazon-tracking-sync kuruldu: her 2 saat");

  // ── freeze-stores: her saat (deneme/paket süresi biten mağazaları dondur) ────
  await clearRepeatableJobs(freezeStoresQueue, "freeze-stores");
  await freezeStoresQueue.add(
    "freeze-stores",
    {},
    { repeat: { every: 60 * 60 * 1000 } } // 1 saat (ms)
  );
  console.log("[scheduler] freeze-stores kuruldu: her saat");
}

/**
 * Belirtilen queue'daki tüm repeatable job'ları temizler.
 * Deployment'ta ayar güncellemelerinin geçerli olması için gerekli.
 */
async function clearRepeatableJobs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queue: { getRepeatableJobs: () => Promise<Array<{ key: string; name: string }>>; removeRepeatableByKey: (key: string) => Promise<boolean> },
  queueName: string
): Promise<void> {
  try {
    const repeatableJobs = await queue.getRepeatableJobs();
    if (repeatableJobs.length === 0) return;

    for (const job of repeatableJobs) {
      await queue.removeRepeatableByKey(job.key);
    }

    console.log(
      `[scheduler] ${queueName}: ${repeatableJobs.length} eski repeatable job temizlendi`
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[scheduler] ${queueName} temizleme hatası: ${errMsg}`
    );
    // Temizleme hatası ölümcül değil — kuruluma devam et
  }
}
