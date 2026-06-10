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
} from "@/lib/queues";

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
