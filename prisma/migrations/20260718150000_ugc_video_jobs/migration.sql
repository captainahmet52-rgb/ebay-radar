-- UGC video üretim işleri (tamamen additive)

CREATE TABLE "UgcVideoJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "step" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'standard',
    "seconds" INTEGER NOT NULL DEFAULT 15,
    "spokenText" TEXT,
    "characterImageUrl" TEXT,
    "editedImageUrl" TEXT,
    "falRequestId" TEXT,
    "videoUrl" TEXT,
    "error" TEXT,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UgcVideoJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UgcVideoJob_userId_createdAt_idx" ON "UgcVideoJob"("userId", "createdAt");

ALTER TABLE "UgcVideoJob" ADD CONSTRAINT "UgcVideoJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UgcVideoJob" ADD CONSTRAINT "UgcVideoJob_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ShopifyListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
