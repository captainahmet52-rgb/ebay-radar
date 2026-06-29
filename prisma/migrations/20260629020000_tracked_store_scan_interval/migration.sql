-- Oto-pilot (P7): mağaza başına otomatik tarama aralığı (saat). 0 = oto-tarama kapalı.
-- Additive / expand-only: sabit varsayılanlı kolon → tablo yeniden yazılmaz (anında çalışır).
ALTER TABLE "TrackedStore"
  ADD COLUMN IF NOT EXISTS "scanIntervalHours" INTEGER NOT NULL DEFAULT 12;
