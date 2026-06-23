-- Affiliate (ortaklık) — komisyonlu tanıtım
ALTER TABLE "User" ADD COLUMN "isAffiliate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "commissionRatePct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "commissionBalanceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;
