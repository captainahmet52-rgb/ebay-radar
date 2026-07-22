-- AmazonDepotProduct: Radar'ın viral/statik izini (amazon|shopify) taşır (2026-07-22)
ALTER TABLE "AmazonDepotProduct" ADD COLUMN "sourceChannel" TEXT NOT NULL DEFAULT 'amazon';

CREATE INDEX "AmazonDepotProduct_sourceChannel_idx" ON "AmazonDepotProduct"("sourceChannel");
