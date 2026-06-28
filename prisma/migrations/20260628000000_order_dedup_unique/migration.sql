-- NO-OP (2026-06-28 geri alındı).
--
-- Bu migration'ın ilk hali (userId, ebayOrderId) UNIQUE index ekliyordu ama prod'da
-- migrate FAIL etti (exit 1) → app migrate'e bağlı olduğu için site komple düştü (503).
-- Acil kurtarma: migration no-op'a çevrildi (artık patlayamaz) + app migrate'ten koparıldı
-- + failed kayıt rolled-back ile temizlendi (compose migrate command).
--
-- Çift sipariş koruması şu an UYGULAMA seviyesinde çalışıyor (webhook + poll-orders
-- findFirst guard). Gerçek DB unique kısıtı, asıl hata anlaşılıp (migrate logları) ve
-- duplicate temizliği test edilince AYRI bir migration olarak güvenle eklenecek.

SELECT 1;
