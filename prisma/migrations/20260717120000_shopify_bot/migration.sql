-- ShopifyBot: mağaza hesapları + listelemeler (AliExpress → Shopify).
-- Tamamen ADDITIVE — mevcut tablolara dokunmaz.

-- CreateTable
CREATE TABLE "ShopifyAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "paidUntil" TIMESTAMP(3),
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "productLimit" INTEGER NOT NULL DEFAULT 300,
    "metaPixelId" TEXT,
    "feedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopifyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopifyAccountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "inventoryItemId" TEXT,
    "salePrice" DOUBLE PRECISION,
    "currentQty" INTEGER NOT NULL DEFAULT 2,
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyAccount_shopDomain_key" ON "ShopifyAccount"("shopDomain");
CREATE UNIQUE INDEX "ShopifyAccount_feedToken_key" ON "ShopifyAccount"("feedToken");
CREATE INDEX "ShopifyAccount_userId_idx" ON "ShopifyAccount"("userId");

CREATE UNIQUE INDEX "ShopifyListing_shopifyAccountId_productId_key" ON "ShopifyListing"("shopifyAccountId", "productId");
CREATE INDEX "ShopifyListing_userId_idx" ON "ShopifyListing"("userId");
CREATE INDEX "ShopifyListing_status_idx" ON "ShopifyListing"("status");

-- AddForeignKey
ALTER TABLE "ShopifyAccount" ADD CONSTRAINT "ShopifyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyListing" ADD CONSTRAINT "ShopifyListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyListing" ADD CONSTRAINT "ShopifyListing_shopifyAccountId_fkey" FOREIGN KEY ("shopifyAccountId") REFERENCES "ShopifyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyListing" ADD CONSTRAINT "ShopifyListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AmazonDepotProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
