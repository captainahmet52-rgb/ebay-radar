-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "role" TEXT NOT NULL DEFAULT 'user',
    "productLimit" INTEGER NOT NULL DEFAULT 100,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "autoUploadEnabled" BOOLEAN NOT NULL DEFAULT false,
    "uploadSchedule" TEXT NOT NULL DEFAULT 'daily',
    "uploadScheduleHour" INTEGER NOT NULL DEFAULT 9,
    "uploadDailyLimit" INTEGER NOT NULL DEFAULT 10,
    "uploadMinProfit" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "uploadMinMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "uploadMinAmazonPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uploadMaxAmazonPrice" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "uploadPrimeOnly" BOOLEAN NOT NULL DEFAULT false,
    "uploadSoldWithinDays" INTEGER,
    "uploadSourceMarket" TEXT NOT NULL DEFAULT 'US',
    "uploadEbaySite" TEXT NOT NULL DEFAULT 'EBAY_US',
    "uploadProfitMarginPct" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "uploadQuantity" INTEGER NOT NULL DEFAULT 1,
    "uploadAutoPublish" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EbayAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ebayUserId" TEXT NOT NULL,
    "oauthTokenEncrypted" TEXT,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "fulfillmentPolicyId" TEXT,
    "paymentPolicyId" TEXT,
    "returnPolicyId" TEXT,
    "merchantLocationKey" TEXT,
    "policiesCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EbayAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "amazonPrice" DOUBLE PRECISION,
    "amazonStockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "amazonStockQty" INTEGER,
    "ebayFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.136,
    "targetMargin" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "floorPrice" DOUBLE PRECISION,
    "calculatedEbayPrice" DOUBLE PRECISION,
    "pollTier" TEXT NOT NULL DEFAULT 'normal',
    "lastScrapedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ebayAccountId" TEXT NOT NULL,
    "ebayListingId" TEXT,
    "ebaySku" TEXT,
    "ebayOfferId" TEXT,
    "currentQty" INTEGER NOT NULL DEFAULT 2,
    "currentPrice" DOUBLE PRECISION,
    "publishStage" TEXT,
    "lastEbayError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "ebayOrderId" TEXT,
    "soldPrice" DOUBLE PRECISION,
    "amazonPriceAtSale" DOUBLE PRECISION,
    "netProfit" DOUBLE PRECISION,
    "ebayFulfillmentId" TEXT,
    "cancellationReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "AutoUploadLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "productsUploaded" INTEGER NOT NULL DEFAULT 0,
    "productsSkipped" INTEGER NOT NULL DEFAULT 0,
    "productsChecked" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoUploadLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedStore" (
    "id" TEXT NOT NULL,
    "ebayUsername" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepotProduct" (
    "id" TEXT NOT NULL,
    "asin" TEXT NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT,
    "category" TEXT,
    "amazonPrice" DOUBLE PRECISION,
    "amazonStockStatus" TEXT NOT NULL DEFAULT 'in_stock',
    "amazonStockQty" INTEGER,
    "ebayFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.136,
    "calculatedEbayPrice" DOUBLE PRECISION,
    "sourceStoreId" TEXT,
    "sourceKeyword" TEXT,
    "lastScrapedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepotProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDistribution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depotProductId" TEXT NOT NULL,
    "listingId" TEXT,
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_asin_key" ON "Product"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedStore_ebayUsername_key" ON "TrackedStore"("ebayUsername");

-- CreateIndex
CREATE UNIQUE INDEX "DepotProduct_asin_key" ON "DepotProduct"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDistribution_listingId_key" ON "ProductDistribution"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDistribution_userId_depotProductId_key" ON "ProductDistribution"("userId", "depotProductId");

-- AddForeignKey
ALTER TABLE "EbayAccount" ADD CONSTRAINT "EbayAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_ebayAccountId_fkey" FOREIGN KEY ("ebayAccountId") REFERENCES "EbayAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoUploadLog" ADD CONSTRAINT "AutoUploadLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepotProduct" ADD CONSTRAINT "DepotProduct_sourceStoreId_fkey" FOREIGN KEY ("sourceStoreId") REFERENCES "TrackedStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDistribution" ADD CONSTRAINT "ProductDistribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDistribution" ADD CONSTRAINT "ProductDistribution_depotProductId_fkey" FOREIGN KEY ("depotProductId") REFERENCES "DepotProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDistribution" ADD CONSTRAINT "ProductDistribution_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
