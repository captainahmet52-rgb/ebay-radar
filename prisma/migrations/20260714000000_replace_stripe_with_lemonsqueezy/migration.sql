-- Stripe entegrasyonu kaldırıldı. Mevcut Lemon Squeezy abonelik ID'lerini veri
-- kaybetmeden doğru isimli kolona taşı ve artık kullanılmayan müşteri ID'sini sil.
ALTER TABLE "User"
  RENAME COLUMN "stripeSubscriptionId" TO "lemonSqueezySubscriptionId";

ALTER TABLE "User"
  DROP COLUMN "stripeCustomerId";
