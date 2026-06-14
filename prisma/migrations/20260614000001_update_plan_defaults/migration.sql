-- Plan varsayılanını "free"den "starter"a güncelle
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'starter';

-- productLimit varsayılanını 100'den 300'e güncelle (starter paketi)
ALTER TABLE "User" ALTER COLUMN "productLimit" SET DEFAULT 300;

-- Mevcut "free" planlı kullanıcıları "starter"a taşı
UPDATE "User" SET "plan" = 'starter', "productLimit" = 300 WHERE "plan" = 'free';
