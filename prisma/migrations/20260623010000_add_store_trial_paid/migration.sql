-- EbayAccount: mağaza başına 7 günlük deneme + ücretli erişim bitiş tarihi
ALTER TABLE "EbayAccount" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "EbayAccount" ADD COLUMN "paidUntil" TIMESTAMP(3);
