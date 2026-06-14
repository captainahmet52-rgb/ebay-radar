-- Trial sistemi: kullanıcı ilk eBay mağazasını bağlayınca trial başlar
ALTER TABLE "User" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
