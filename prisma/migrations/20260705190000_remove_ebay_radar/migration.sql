-- eBay ürün radarı kaldırıldı (ürün radarı özelliği tamamen çıkarıldı).
-- TrackedStore tablosu ve DepotProduct'taki radar kaynak alanları düşürülür.
-- DepotProduct satırları (depo) KORUNUR — sadece radar bağlantısı kalkar.

ALTER TABLE "DepotProduct" DROP CONSTRAINT IF EXISTS "DepotProduct_sourceStoreId_fkey";
ALTER TABLE "DepotProduct" DROP COLUMN IF EXISTS "sourceStoreId";
ALTER TABLE "DepotProduct" DROP COLUMN IF EXISTS "sourceKeyword";
DROP TABLE IF EXISTS "TrackedStore";
