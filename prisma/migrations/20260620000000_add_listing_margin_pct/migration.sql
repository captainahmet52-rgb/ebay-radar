-- Listing'e batch kâr marjı (toplu yüklemede o partinin marjı; yoksa kullanıcı/ürün marjı)
ALTER TABLE "Listing" ADD COLUMN "marginPct" DOUBLE PRECISION;
