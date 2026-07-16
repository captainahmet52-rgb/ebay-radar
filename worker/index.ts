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
// amazon-radar-scan + amazon-depot-watchdog KALDIRILDI — keşif Radar projesine taşındı.
import { createAmazonAutoUploadWorker } from "./jobs/amazon-auto-upload";
import { createAmazonPollProductWorker } from "./jobs/amazon-poll-product";
import { createAmazonUpdateListingWorker } from "./jobs/amazon-update-listing";
import { createDispatchAmazonPollsWorker } from "./jobs/amazon-dispatch-polls";
import { createAmazonPollOrdersWorker } from "./jobs/amazon-poll-orders";
import { createAmazonVerifyOrderWorker } from "./jobs/amazon-verify-order";
import { createAmazonFulfillOrderWorker } from "./jobs/amazon-fulfill-order";
import { createAmazonTrackingSyncWorker } from "./jobs/amazon-tracking-sync";
import { createDistributeProductsWorker } from "./jobs/distribute-products";
import { createRefreshTokensWorker } from "./jobs/refresh-tokens";
import { createDispatchPollsWorker } from "./jobs/dispatch-polls";
import { createDispatchPollOrdersWorker } from "./jobs/dispatch-poll-orders";
import { createFreezeStoresWorker } from "./jobs/freeze-stores";
import { createFreezeAmazonAccountsWorker } from "./jobs/freeze-amazon-accounts";
import { createPublishListingWorker } from "./jobs/publish-listing";
import { createEbayAutoUploadWorker } from "./jobs/ebay-auto-upload";
import { createRetierProductsWorker } from "./jobs/retier-products";
import { createScraperUsageCheckWorker } from "./jobs/scraper-usage-check";
import { createListingImportWorker } from "./jobs/listing-import";
import { createVerifyImportMatchWorker } from "./jobs/verify-import-match";
import { setupScheduler } from "./scheduler";

// ─── Worker'ları başlat ────────────────────────────────────────────────────────
console.log("[worker] Başlatılıyor...");

const workers: Worker[] = [
  createPollProductWorker(connection),
  createVerifyOrderWorker(connection),
  createPollOrdersWorker(connection),
  createUpdateListingWorker(connection),
  createAmazonAutoUploadWorker(connection),
  createAmazonPollProductWorker(connection),
  createAmazonUpdateListingWorker(connection),
  createDispatchAmazonPollsWorker(connection),
  createAmazonPollOrdersWorker(connection),
  createAmazonVerifyOrderWorker(connection),
  createAmazonFulfillOrderWorker(connection),
  createAmazonTrackingSyncWorker(connection),
  createDistributeProductsWorker(connection),
  createRefreshTokensWorker(connection),
  createDispatchPollsWorker(connection),
  createDispatchPollOrdersWorker(connection),
  createFreezeStoresWorker(connection),
  createFreezeAmazonAccountsWorker(connection),
  createPublishListingWorker(connection),
  createEbayAutoUploadWorker(connection),
  createRetierProductsWorker(connection),
  createScraperUsageCheckWorker(connection),
  createListingImportWorker(connection),
  createVerifyImportMatchWorker(connection),
];

console.log(`[worker] ${workers.length} worker aktif:`);
console.log("  → poll-product           (concurrency: 4)");
console.log("  → verify-order           (concurrency: 4)");
console.log("  → poll-orders            (concurrency: 2)");
console.log("  → update-listing         (concurrency: 4)");
console.log("  → amazon-auto-upload     (concurrency: 2)");
console.log("  → amazon-poll-product    (concurrency: 4)");
console.log("  → amazon-update-listing  (concurrency: 4)");
console.log("  → dispatch-amazon-polls  (concurrency: 1)");
console.log("  → amazon-poll-orders     (concurrency: 2)");
console.log("  → amazon-verify-order    (concurrency: 4)");
console.log("  → amazon-fulfill-order   (concurrency: 2)");
console.log("  → amazon-tracking-sync   (concurrency: 1)");
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
    // Scheduler kurulamazsa periyodik tarama (fiyat/stok/sipariş) HİÇ çalışmaz —
    // süreç "sağlıklı" görünüp sessizce işlevsiz kalmasın: çık, Docker
    // (restart: unless-stopped) yeniden başlatır ve kurulum tekrar denenir.
    console.error("[worker] Scheduler kurulamadı — süreç yeniden başlatılacak:", errMsg);
    process.exit(1);
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
