#!/bin/sh
# PostgreSQL Günlük Yedek Scripti
# Docker backup servisinin cron'u tarafından çalıştırılır.
# Çevre değişkeni: PGPASSWORD (docker-compose.yml'den gelir)

set -e

DATE=$(date +%Y%m%d_%H%M%S)
FILE="/backups/ebay_db_${DATE}.sql.gz"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Yedek başlatılıyor..."

# Veritabanını dışa aktar ve sıkıştır
pg_dump \
  -h postgres \
  -U ebay_user \
  -d ebay_db \
  --no-password \
  --verbose \
  --clean \
  --if-exists \
  | gzip > "$FILE"

# Dosya boyutunu göster
SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Yedek tamamlandı: $FILE ($SIZE)"

# 30 günden eski yedekleri sil
DELETED=$(find /backups -name "*.sql.gz" -mtime +30 -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Temizlik: $DELETED eski yedek silindi."
fi

# Mevcut yedek sayısını göster
TOTAL=$(find /backups -name "*.sql.gz" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Toplam yedek sayısı: $TOTAL"
