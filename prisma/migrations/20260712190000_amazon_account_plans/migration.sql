-- Amazon (AliExpress→Amazon) tarafina eBay'deki "paket = hesap" sistemini tasir
-- (bkz. EbayAccount + EbayTrialHistory). EXPAND-ONLY: yeni sutunlar DEFAULT'lu,
-- yeni bos tablo — mevcut hicbir satiri kilitlemez, aninda uygulanir.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "amazonTrialEndsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AmazonAccount" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AmazonAccount" ADD COLUMN "activatedAt" TIMESTAMP(3);
ALTER TABLE "AmazonAccount" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "AmazonAccount" ADD COLUMN "paidUntil" TIMESTAMP(3);
ALTER TABLE "AmazonAccount" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "AmazonAccount" ADD COLUMN "productLimit" INTEGER NOT NULL DEFAULT 300;

-- GERİYE UYUMLULUK: bu migration'dan ÖNCE bağlanmış hesaplar hiç ödeme/deneme
-- akışından geçmedi — yeni isActive=false varsayılanıyla aniden donmasınlar diye
-- comp (bedava süresiz) erişimle grandfather edilir. Bu satırdan SONRA bağlanan
-- hesaplar normal akıştan (OAuth callback → trial ya da frozen) geçer.
UPDATE "AmazonAccount" SET "isActive" = true, "paidUntil" = '2099-12-31 00:00:00'::timestamp;

-- CreateTable
CREATE TABLE "AmazonTrialHistory" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonTrialHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmazonTrialHistory_sellerId_key" ON "AmazonTrialHistory"("sellerId");

-- CreateIndex
CREATE INDEX "AmazonTrialHistory_userId_idx" ON "AmazonTrialHistory"("userId");
