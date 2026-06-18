// Worker process entry point
// Çalıştırma: tsx worker/index.ts
// veya: node -r tsconfig-paths/register -r ts-node/register worker/index.ts
import "dotenv/config";

import { Worker } from "bullmq";
import { connection } from "@/lib/queues";
import { createPollProductWorker } from "./jobs/poll-product";
import { createVerifyOrderWorker } from "./jobs/verify-order";
import { createPollOrdersWorker } from "./jobs/poll-orders";
import { createUpdateListingWorker } from "./jobs/update-listing";
import { createRadarScanWorker } from "./jobs/radar-scan";
import { createAmazonRadarScanWorker } from "./jobs/amazon-radar-scan";
import { createDistributeProductsWorker } from "./jobs/distribute-products";
import { createRefreshTokensWorker } from "./jobs/refresh-tokens";
import { createDispatchPollsWorker } from "./jobs/dispatch-polls";
import { createDispatchPollOrdersWorker } from "./jobs/dispatch-poll-orders";
import { setupScheduler } from "./scheduler";

// ─── Worker'ları başlat ────────────────────────────────────────────────────────
console.log("[worker] Başlatılıyor...");

const workers: Worker[] = [
  createPollProductWorker(connection),
  createVerifyOrderWorker(connection),
  createPollOrdersWorker(connection),
  createUpdateListingWorker(connection),
  createRadarScanWorker(connection),
  createAmazonRadarScanWorker(connection),
  createDistributeProductsWorker(connection),
  createRefreshTokensWorker(connection),
  createDispatchPollsWorker(connection),
  createDispatchPollOrdersWorker(connection),
];

console.log(`[worker] ${workers.length} worker aktif:`);
console.log("  → poll-product           (concurrency: 4)");
console.log("  → verify-order           (concurrency: 4)");
console.log("  → poll-orders            (concurrency: 2)");
console.log("  → update-listing         (concurrency: 4)");
console.log("  → radar-scan             (concurrency: 2)");
console.log("  → amazon-radar-scan      (concurrency: 2)");
console.log("  → distribute-products    (concurrency: 2)");
console.log("  → refresh-tokens         (concurrency: 2)");
console.log("  → dispatch-polls         (concurrency: 1)");
console.log("  → dispatch-poll-orders   (concurrency: 1)");
console.log("[worker] Hazır. Kuyruk dinleniyor...");

// ─── Repeatable job'ları kur ──────────────────────────────────────────────────
setupScheduler()
  .then(() => {
    console.log("[worker] Scheduler kuruldu.");
  })
  .catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[worker] Scheduler hatası:", errMsg);
  });

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  console.log(`\n[worker] ${signal} alındı — worker'lar kapatılıyor...`);

  const closePromises = workers.map(async (worker) => {
    try {
      // Çalışan job'ların bitmesini bekle, yeni job kabul etme
      await worker.close();
      console.log(`[worker] Worker kapatıldı: ${worker.name}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[worker] Worker kapatma hatası (${worker.name}): ${errMsg}`);
    }
  });

  await Promise.allSettled(closePromises);

  // ConnectionOptions bir plain object — quit() metodu yok; worker.close() Redis'i kapatır
  console.log("[worker] Kapatma tamamlandı. Çıkılıyor.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Yakalanmayan hataları logla — process'i çöktürme
process.on("unhandledRejection", (reason, promise) => {
  console.error("[worker] Yakalanmayan Promise reddi:", promise, "Sebep:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[worker] Yakalanmayan exception:", err);
  // Kritik hata → güvenli kapatma
  shutdown("uncaughtException").catch(() => process.exit(1));
});
