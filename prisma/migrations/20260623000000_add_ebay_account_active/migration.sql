-- EbayAccount: mağaza aktifleştirme (plan limiti dahilinde). Pasif gelir, aktifleşince ürün/radar çalışır.
ALTER TABLE "EbayAccount" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EbayAccount" ADD COLUMN "activatedAt" TIMESTAMP(3);
