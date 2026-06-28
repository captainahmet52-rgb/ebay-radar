-- eBay deneme geçmişi tablosu (bedava deneme suistimal koruması).
--
-- EXPAND-ONLY: yeni BOŞ tablo + üzerinde index/unique. Mevcut hiçbir satırı
-- kilitlemez/dönüştürmez → migration takılma riski yok, anında uygulanır.
-- Her ebayUserId global olarak tek kez deneme alabilsin diye ebayUserId UNIQUE.

-- CreateTable
CREATE TABLE "EbayTrialHistory" (
    "id" TEXT NOT NULL,
    "ebayUserId" TEXT NOT NULL,
    "userId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EbayTrialHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EbayTrialHistory_ebayUserId_key" ON "EbayTrialHistory"("ebayUserId");

-- CreateIndex
CREATE INDEX "EbayTrialHistory_userId_idx" ON "EbayTrialHistory"("userId");
