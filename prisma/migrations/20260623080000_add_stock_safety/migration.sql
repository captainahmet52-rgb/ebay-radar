-- Stok güvenliği: duraklatma sebebi + tarama hata izleme
ALTER TABLE "Product" ADD COLUMN "pauseReason" TEXT;
ALTER TABLE "Product" ADD COLUMN "scrapeFailCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN "lastScrapeError" TEXT;

-- Dispatch ve auto-recovery sorguları için indeksler
CREATE INDEX "Product_status_pollTier_lastScrapedAt_idx" ON "Product"("status", "pollTier", "lastScrapedAt");
CREATE INDEX "Product_status_pauseReason_lastScrapedAt_idx" ON "Product"("status", "pauseReason", "lastScrapedAt");
