-- Çift sipariş koruması: (userId, ebayOrderId) benzersiz kısıtı.
-- Webhook + polling aynı siparişi yarış halinde işlerse ikinci create artık P2002 ile
-- düşer → çift Order satırı oluşamaz (eskiden sadece findFirst guard vardı = TOCTOU açığı).
--
-- GÜVENLİ SIRA: önce mevcut çiftleri temizle, SONRA unique index oluştur. Aksi halde
-- veride çift varsa index oluşturma patlar (migrate fail → deploy bloke). Sipariş tablosu
-- şu an boş/çok küçük (canlı satış yok) ama bu temizlik defensive — her durumda güvenli.
-- ebayOrderId NULL olan kayıtlar Postgres'te çakışmaz (NULL distinct) → dokunulmaz.

DELETE FROM "Order" a
USING "Order" b
WHERE a."userId" = b."userId"
  AND a."ebayOrderId" = b."ebayOrderId"
  AND a."ebayOrderId" IS NOT NULL
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_ebayOrderId_key" ON "Order"("userId", "ebayOrderId");
