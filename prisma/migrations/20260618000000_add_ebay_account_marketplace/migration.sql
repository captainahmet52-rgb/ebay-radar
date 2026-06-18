-- AlterTable: EbayAccount — mağazanın bağlı olduğu eBay pazarı (bağlanırken otomatik tespit)
-- EBAY_US | EBAY_GB | EBAY_DE | EBAY_AU
ALTER TABLE "EbayAccount" ADD COLUMN "marketplace" TEXT NOT NULL DEFAULT 'EBAY_US';
