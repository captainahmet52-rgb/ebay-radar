-- Ortak depo AI ürün medyası (tamamen additive)
ALTER TABLE "AmazonDepotProduct" ADD COLUMN "aiImageUrls" JSONB;
ALTER TABLE "AmazonDepotProduct" ADD COLUMN "aiVideoUrl" TEXT;
