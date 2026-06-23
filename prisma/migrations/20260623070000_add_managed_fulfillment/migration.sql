-- Managed Fulfillment: admin Amazon'dan alır, kullanıcı öder, takip eBay'e gider
ALTER TABLE "Order" ADD COLUMN "managedStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToName" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToLine1" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToLine2" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToCity" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToState" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToZip" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToCountry" TEXT;
ALTER TABLE "Order" ADD COLUMN "shipToPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "sourceCostUsd" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "markupUsd" DOUBLE PRECISION;
ALTER TABLE "Order" ADD COLUMN "amazonTrackingNo" TEXT;
ALTER TABLE "Order" ADD COLUMN "orderChargePaidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "trackingChargePaidAt" TIMESTAMP(3);

CREATE INDEX "Order_managedStatus_idx" ON "Order"("managedStatus");
