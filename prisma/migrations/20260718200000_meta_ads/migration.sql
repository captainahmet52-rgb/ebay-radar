-- Meta (Facebook/Instagram) Marketing API entegrasyonu (tamamen additive)

CREATE TABLE "MetaAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shopifyAccountId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "businessName" TEXT,
    "pageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaAccount_shopifyAccountId_key" ON "MetaAccount"("shopifyAccountId");
CREATE INDEX "MetaAccount_userId_idx" ON "MetaAccount"("userId");

ALTER TABLE "MetaAccount" ADD CONSTRAINT "MetaAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAccount" ADD CONSTRAINT "MetaAccount_shopifyAccountId_fkey" FOREIGN KEY ("shopifyAccountId") REFERENCES "ShopifyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MetaCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metaAccountId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "metaCampaignId" TEXT NOT NULL,
    "metaAdSetId" TEXT NOT NULL,
    "metaAdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAUSED',
    "dailyBudgetUsd" DOUBLE PRECISION NOT NULL,
    "headline" TEXT,
    "primaryText" TEXT,
    "spendUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MetaCampaign_userId_idx" ON "MetaCampaign"("userId");
CREATE INDEX "MetaCampaign_metaAccountId_idx" ON "MetaCampaign"("metaAccountId");

ALTER TABLE "MetaCampaign" ADD CONSTRAINT "MetaCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaCampaign" ADD CONSTRAINT "MetaCampaign_metaAccountId_fkey" FOREIGN KEY ("metaAccountId") REFERENCES "MetaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaCampaign" ADD CONSTRAINT "MetaCampaign_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ShopifyListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
