-- AmazonBot (AliExpress → Amazon) — kendi bağımsız depo/hesap/listeleme modelleri

-- CreateTable: AmazonAccount (bağlı Amazon satıcı hesabı, pazar SP-API ile tespit)
CREATE TABLE "AmazonAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'us',
    "spapiRefreshTokenEncrypted" TEXT,
    "spapiAccessTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AmazonDepotProduct (AmazonBot kendi deposu, AliExpress kaynağı)
CREATE TABLE "AmazonDepotProduct" (
    "id" TEXT NOT NULL,
    "aliId" TEXT NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "brand" TEXT,
    "brandSafe" BOOLEAN NOT NULL DEFAULT true,
    "aliCostUsd" DOUBLE PRECISION NOT NULL,
    "aliShippingUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aliOrders" INTEGER NOT NULL DEFAULT 0,
    "aliRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aliStockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "aliStockQty" INTEGER,
    "amazonBsr" INTEGER,
    "amazonSalesEst" INTEGER,
    "amazonSellerCount" INTEGER,
    "amazonSoldByAmazon" BOOLEAN NOT NULL DEFAULT false,
    "radarScore" INTEGER,
    "pollTier" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastScrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmazonDepotProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AmazonListing (kullanıcı listelemeleri)
CREATE TABLE "AmazonListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amazonAccountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'us',
    "asin" TEXT,
    "sku" TEXT,
    "salePrice" DOUBLE PRECISION,
    "currentQty" INTEGER NOT NULL DEFAULT 2,
    "publishStage" TEXT,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmazonListing_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "AmazonAccount_userId_idx" ON "AmazonAccount"("userId");
CREATE UNIQUE INDEX "AmazonDepotProduct_aliId_key" ON "AmazonDepotProduct"("aliId");
CREATE INDEX "AmazonDepotProduct_status_idx" ON "AmazonDepotProduct"("status");
CREATE INDEX "AmazonDepotProduct_pollTier_idx" ON "AmazonDepotProduct"("pollTier");
CREATE UNIQUE INDEX "AmazonListing_amazonAccountId_productId_key" ON "AmazonListing"("amazonAccountId", "productId");
CREATE INDEX "AmazonListing_userId_idx" ON "AmazonListing"("userId");
CREATE INDEX "AmazonListing_status_idx" ON "AmazonListing"("status");

-- Foreign keys
ALTER TABLE "AmazonAccount" ADD CONSTRAINT "AmazonAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmazonListing" ADD CONSTRAINT "AmazonListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmazonListing" ADD CONSTRAINT "AmazonListing_amazonAccountId_fkey" FOREIGN KEY ("amazonAccountId") REFERENCES "AmazonAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmazonListing" ADD CONSTRAINT "AmazonListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AmazonDepotProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
