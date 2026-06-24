-- Order dedup: aynı eBay siparişi (userId + ebayOrderId) birden fazla Order satırı
-- oluşturamasın. Çift fulfillment / çift ücret kritik hatasını engeller.
--
-- 1) Önce olası mevcut çiftleri temizle (defansif). Her (userId, ebayOrderId)
--    grubunda en eski (createdAt, id) satırı tutulur; sonrakiler silinir.
--    ebayOrderId NULL olan satırlar dedup'a dahil edilmez (NULL'lar benzersiz indekste
--    zaten çakışmaz ve gerçek bir sipariş kimliği taşımazlar).
DELETE FROM "Order" o
USING "Order" dup
WHERE o."ebayOrderId" IS NOT NULL
  AND o."ebayOrderId" = dup."ebayOrderId"
  AND o."userId" = dup."userId"
  AND (
    o."createdAt" > dup."createdAt"
    OR (o."createdAt" = dup."createdAt" AND o."id" > dup."id")
  );

-- 2) Benzersiz indeks. Postgres NULL'ları farklı sayar; ebayOrderId NULL satırlar
--    serbest kalır, dolu olanlar (userId, ebayOrderId) bazında tekilleşir.
CREATE UNIQUE INDEX "Order_userId_ebayOrderId_key" ON "Order"("userId", "ebayOrderId");
