-- Sıcak ürün sinyali: rakipte en son gözlenen satış anı (Radar gönderir).
-- Oto yüklemenin "son X günde satılmış" filtresi bu kolonla gerçekten çalışır hale gelir.
ALTER TABLE "DepotProduct" ADD COLUMN "lastSoldAt" TIMESTAMP(3);
