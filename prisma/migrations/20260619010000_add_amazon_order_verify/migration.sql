-- Sipariş-anı doğrulama alanları (canlı AliExpress stok/fiyat kontrolü)
ALTER TABLE "AmazonOrder" ADD COLUMN "verifyNote" TEXT;
ALTER TABLE "AmazonOrder" ADD COLUMN "verifiedAt" TIMESTAMP(3);
