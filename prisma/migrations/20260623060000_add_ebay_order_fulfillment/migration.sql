-- eBay sipariş kargo/takip alanları + otomatik kargolama tercihi
ALTER TABLE "Order" ADD COLUMN "ebayLineItemId" TEXT;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
ALTER TABLE "Order" ADD COLUMN "carrierCode" TEXT;
ALTER TABLE "Order" ADD COLUMN "shippedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "ebayAutoFulfill" BOOLEAN NOT NULL DEFAULT false;
