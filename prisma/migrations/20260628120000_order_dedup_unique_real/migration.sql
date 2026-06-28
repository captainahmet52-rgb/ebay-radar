-- Çift sipariş koruması: (userId, ebayOrderId) UNIQUE — GERÇEK kısıt.
--
-- ARKA PLAN: Bu kısıtın ilk denemesi (20260628000000_order_dedup_unique) prod'da fail
-- etmişti (muhtemelen mevcut duplike satırlar vardı → CREATE UNIQUE INDEX patladı) ve
-- o sırada app migrate'e bağlı olduğu için site komple düştü. O migration NO-OP'a
-- çevrildi; app artık migrate'e bağlı DEĞİL (fail etse bile site ayakta kalır).
--
-- BU SEFER GÜVENLİ: ÖNCE duplike'leri temizliyoruz (her grupta EN ESKİ kayıt tutulur),
-- SONRA index'i kuruyoruz → CREATE UNIQUE artık çakışamaz. Prisma her migration'ı tek
-- transaction'da çalıştırır → DELETE + CREATE atomik (biri patlarsa ikisi de geri alınır).
--
-- ebayOrderId NULL olan satırlar (manuel sipariş) HİÇ etkilenmez: NULL = NULL → false,
-- yani DELETE eşleşmez ve Postgres NULL'ları unique index'te distinct sayar.

-- 1) Duplike temizliği: aynı (userId, ebayOrderId) için en eski (createdAt, eşitse id)
--    kaydı TUT, fazlalıkları sil.
DELETE FROM "Order" a
USING "Order" b
WHERE a."ebayOrderId" IS NOT NULL
  AND a."userId" = b."userId"
  AND a."ebayOrderId" = b."ebayOrderId"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

-- 2) Unique index — Prisma @@unique([userId, ebayOrderId]) ile AYNI isim (drift olmaz).
CREATE UNIQUE INDEX IF NOT EXISTS "Order_userId_ebayOrderId_key" ON "Order"("userId", "ebayOrderId");
