-- Satış-hızına göre tier için son satış anı
ALTER TABLE "Product" ADD COLUMN "lastSoldAt" TIMESTAMP(3);
CREATE INDEX "Product_status_lastSoldAt_idx" ON "Product"("status", "lastSoldAt");

-- Stok/fiyat geçmişi (snapshot)
CREATE TABLE "StockSnapshot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "amazonPrice" DOUBLE PRECISION,
    "stockStatus" TEXT NOT NULL,
    "stockQty" INTEGER,
    "ebayPrice" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'poll',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockSnapshot_productId_createdAt_idx" ON "StockSnapshot"("productId", "createdAt");
CREATE INDEX "StockSnapshot_createdAt_idx" ON "StockSnapshot"("createdAt");
ALTER TABLE "StockSnapshot" ADD CONSTRAINT "StockSnapshot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
