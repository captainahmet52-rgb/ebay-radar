-- AmazonBot oto-yükleme + müşteri kuralları (User üzerinde)
ALTER TABLE "User" ADD COLUMN "amazonAutoUploadEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "amazonUploadDailyLimit" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "User" ADD COLUMN "amazonUploadMinCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 8;
ALTER TABLE "User" ADD COLUMN "amazonUploadMaxCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN "amazonUploadQuantity" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "User" ADD COLUMN "amazonUploadAutoPublish" BOOLEAN NOT NULL DEFAULT true;
-- Pazar başına müşteri marj override (null → pazar varsayılanı)
ALTER TABLE "User" ADD COLUMN "amazonMarginUsPct" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "amazonMarginUkPct" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "amazonMarginAePct" DOUBLE PRECISION;
ALTER TABLE "User" ADD COLUMN "amazonMarginSaPct" DOUBLE PRECISION;
