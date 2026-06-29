-- Radar "para motoru" (P5): talep (sold count) + kârlılık + rekabetçilik sinyalleri.
-- Additive / expand-only: yalnız yeni nullable kolon ekler, mevcut veriye dokunmaz.
-- rankScore NOT NULL DEFAULT 0 → sabit varsayılan, tablo yeniden yazılmaz (anında çalışır).
ALTER TABLE "DepotProduct"
  ADD COLUMN IF NOT EXISTS "soldCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "competitorPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "projectedProfit" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "projectedMarginPct" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rankScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Dağıtım sırası (status + rankScore) için indeks.
CREATE INDEX IF NOT EXISTS "DepotProduct_status_rankScore_idx"
  ON "DepotProduct" ("status", "rankScore");
