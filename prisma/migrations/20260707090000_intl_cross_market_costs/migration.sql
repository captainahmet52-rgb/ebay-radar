-- Uluslararası / çapraz pazar maliyet ayarları (kullanıcı bazında).
-- Kaynak: eBay resmi international fee sayfası (2026-07 doğrulandı).
-- TR kayıtlı satıcı varsayılanları: intl %1.55 ("Rest of World"), kur çevrim %3.0.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ebayIntlFeePct" DOUBLE PRECISION NOT NULL DEFAULT 1.55;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ebayFxFeePct" DOUBLE PRECISION NOT NULL DEFAULT 3.0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "crossExtraPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "crossExtraFixed" DOUBLE PRECISION NOT NULL DEFAULT 0;
