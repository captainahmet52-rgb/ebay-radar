-- Mevcut eBay ilanlarını içe aktarma özelliği (ListingImport + ImportedListing)
-- + Listing.isLegacy bayrağı.
--
-- GÜVENLİK NOTU (expand-only): Bu migration tamamen EKLEMELİDİR.
--   * Listing.isLegacy → DEFAULT'lu yeni kolon (PG11+ metadata-only, tablo yeniden yazılmaz).
--   * ListingImport / ImportedListing → yeni BOŞ tablolar.
--   * Tüm FK'ler yeni BOŞ tablolar üzerinde → doğrulanacak mevcut satır yok, anında uygulanır.
-- Hiçbir mevcut veriyi kilitlemez/dönüştürmez → "migration takılması" riski yoktur.

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "isLegacy" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ListingImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ebayAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'getmyebayselling',
    "totalListings" INTEGER NOT NULL DEFAULT 0,
    "processedListings" INTEGER NOT NULL DEFAULT 0,
    "confirmedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "pageCursor" INTEGER,
    "totalPages" INTEGER,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ebayAccountId" TEXT NOT NULL,
    "ebayItemId" TEXT NOT NULL,
    "ebaySku" TEXT,
    "title" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER,
    "imageUrl" TEXT,
    "ebaySite" TEXT NOT NULL DEFAULT 'EBAY_US',
    "detectedAsin" TEXT,
    "amazonMarket" TEXT NOT NULL DEFAULT 'US',
    "matchStatus" TEXT NOT NULL DEFAULT 'pending',
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchReason" TEXT,
    "trackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "linkedProductId" TEXT,
    "linkedListingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingImport_ebayAccountId_status_idx" ON "ListingImport"("ebayAccountId", "status");

-- CreateIndex
CREATE INDEX "ListingImport_userId_status_idx" ON "ListingImport"("userId", "status");

-- CreateIndex
CREATE INDEX "ImportedListing_userId_matchStatus_idx" ON "ImportedListing"("userId", "matchStatus");

-- CreateIndex
CREATE INDEX "ImportedListing_ebayAccountId_matchStatus_idx" ON "ImportedListing"("ebayAccountId", "matchStatus");

-- CreateIndex
CREATE INDEX "ImportedListing_matchStatus_trackingEnabled_idx" ON "ImportedListing"("matchStatus", "trackingEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedListing_ebayAccountId_ebayItemId_key" ON "ImportedListing"("ebayAccountId", "ebayItemId");

-- AddForeignKey
ALTER TABLE "ListingImport" ADD CONSTRAINT "ListingImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingImport" ADD CONSTRAINT "ListingImport_ebayAccountId_fkey" FOREIGN KEY ("ebayAccountId") REFERENCES "EbayAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedListing" ADD CONSTRAINT "ImportedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedListing" ADD CONSTRAINT "ImportedListing_ebayAccountId_fkey" FOREIGN KEY ("ebayAccountId") REFERENCES "EbayAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportedListing" ADD CONSTRAINT "ImportedListing_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
