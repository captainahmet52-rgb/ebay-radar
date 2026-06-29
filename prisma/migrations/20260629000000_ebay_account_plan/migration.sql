-- PAKET = MAĞAZA modeli: her eBay mağazası kendi aboneliğine (paket + ürün limiti) sahip.
-- Additive / expand-only: yalnızca yeni kolon ekler, mevcut veriye dokunmaz.
-- ADD COLUMN ... DEFAULT (sabit) Postgres'te tabloyu yeniden yazmaz → anında çalışır,
-- app'i kilitlemez (mevcut satırlar varsayılanla doldurulur).
ALTER TABLE "EbayAccount"
  ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS "productLimit" INTEGER NOT NULL DEFAULT 300;
