-- Satış olunca AliExpress'e otomatik sipariş (oto-buy)
ALTER TABLE "User" ADD COLUMN "amazonAutoFulfill" BOOLEAN NOT NULL DEFAULT false;
