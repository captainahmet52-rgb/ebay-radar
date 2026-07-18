-- ShopifyBot sipariş çekme + uninstall izleme (tamamen additive — mevcut veri etkilenmez)

ALTER TABLE "ShopifyAccount" ADD COLUMN "lastOrdersSyncAt" TIMESTAMP(3);
ALTER TABLE "ShopifyAccount" ADD COLUMN "uninstalledAt" TIMESTAMP(3);

CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopifyAccountId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "lineItems" JSONB NOT NULL,
    "sourcingStatus" TEXT NOT NULL DEFAULT 'ok',
    "aliCostUsd" DOUBLE PRECISION,
    "shopifyCreatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopifyOrder_shopifyAccountId_shopifyOrderId_key" ON "ShopifyOrder"("shopifyAccountId", "shopifyOrderId");
CREATE INDEX "ShopifyOrder_userId_shopifyCreatedAt_idx" ON "ShopifyOrder"("userId", "shopifyCreatedAt");

ALTER TABLE "ShopifyOrder" ADD CONSTRAINT "ShopifyOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopifyOrder" ADD CONSTRAINT "ShopifyOrder_shopifyAccountId_fkey" FOREIGN KEY ("shopifyAccountId") REFERENCES "ShopifyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
