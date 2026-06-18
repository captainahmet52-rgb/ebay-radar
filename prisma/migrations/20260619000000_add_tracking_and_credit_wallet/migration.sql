-- Ön ödemeli kredi cüzdanı
ALTER TABLE "User" ADD COLUMN "creditBalanceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable: AmazonOrder (sipariş + takip kodu senkronu)
CREATE TABLE "AmazonOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amazonAccountId" TEXT,
    "listingId" TEXT,
    "amazonOrderId" TEXT NOT NULL,
    "market" TEXT NOT NULL DEFAULT 'us',
    "soldPrice" DOUBLE PRECISION,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "aliOrderId" TEXT,
    "aliTrackingNo" TEXT,
    "validCarrierCode" TEXT,
    "validTrackingNo" TEXT,
    "trackingStatus" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'unshipped',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmazonOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CreditTransaction (cüzdan ledger)
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "AmazonOrder_amazonOrderId_key" ON "AmazonOrder"("amazonOrderId");
CREATE INDEX "AmazonOrder_userId_idx" ON "AmazonOrder"("userId");
CREATE INDEX "AmazonOrder_trackingStatus_idx" ON "AmazonOrder"("trackingStatus");
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- Foreign keys
ALTER TABLE "AmazonOrder" ADD CONSTRAINT "AmazonOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AmazonOrder" ADD CONSTRAINT "AmazonOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "AmazonListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
