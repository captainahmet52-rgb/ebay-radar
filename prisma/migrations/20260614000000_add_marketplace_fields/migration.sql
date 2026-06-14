-- AlterTable: Product — Amazon marketplace alanı ekle (US | UK)
ALTER TABLE "Product" ADD COLUMN "amazonMarket" TEXT NOT NULL DEFAULT 'US';

-- AlterTable: DepotProduct — Amazon marketplace alanı ekle
ALTER TABLE "DepotProduct" ADD COLUMN "amazonMarket" TEXT NOT NULL DEFAULT 'US';

-- AlterTable: Listing — eBay site alanı ekle (EBAY_US | EBAY_GB)
ALTER TABLE "Listing" ADD COLUMN "ebaySite" TEXT NOT NULL DEFAULT 'EBAY_US';
