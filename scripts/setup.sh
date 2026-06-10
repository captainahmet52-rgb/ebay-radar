#!/bin/bash
# eBay Otomasyon SaaS — İlk Kurulum Scripti
# Kullanım: chmod +x scripts/setup.sh && ./scripts/setup.sh
set -e

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   eBay Otomasyon SaaS — Kurulum Başlatıldı      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── 1. .env dosyası yoksa örneği kopyala ───────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "[1/6] ✓ .env.example → .env olarak kopyalandı."
    echo "      ⚠  Lütfen .env dosyasını düzenleyip API anahtarlarını girin!"
    echo "      Düzenledikten sonra bu scripti tekrar çalıştırın."
    exit 0
  else
    echo "[1/6] ✗ .env dosyası bulunamadı ve .env.example da yok."
    echo "      Lütfen önce .env dosyasını oluşturun."
    exit 1
  fi
else
  echo "[1/6] ✓ .env dosyası mevcut."
fi

# ── 2. Gerekli klasörleri oluştur ──────────────────────────────────────────
mkdir -p backups nginx/ssl
echo "[2/6] ✓ backups/ ve nginx/ssl/ klasörleri hazır."

# ── 3. PostgreSQL ve Redis'i ayağa kaldır ──────────────────────────────────
echo "[3/6] PostgreSQL ve Redis başlatılıyor..."
docker compose up -d postgres redis

echo "      PostgreSQL başlaması bekleniyor (15 saniye)..."
sleep 15

# Healthcheck ile bekle
MAX_WAIT=60
WAITED=0
until docker compose exec postgres pg_isready -U ebay_user -d ebay_db > /dev/null 2>&1; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    echo "      ✗ PostgreSQL $MAX_WAIT saniye içinde hazır olmadı. Logları kontrol edin:"
    docker compose logs postgres
    exit 1
  fi
  sleep 3
  WAITED=$((WAITED + 3))
  echo "      Bekleniyor... ($WAITED/$MAX_WAIT sn)"
done
echo "[3/6] ✓ PostgreSQL hazır."

# ── 4. Prisma migration ─────────────────────────────────────────────────────
echo "[4/6] Prisma migration çalıştırılıyor..."
npm run db:migrate
echo "[4/6] ✓ Veritabanı şeması oluşturuldu."

# ── 5. Tüm servisleri derle ve başlat ──────────────────────────────────────
echo "[5/6] Tüm servisler derleniyor ve başlatılıyor (bu birkaç dakika sürebilir)..."
docker compose up -d --build
echo "[5/6] ✓ Tüm servisler çalışıyor."

# ── 6. Durum özeti ─────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║              Kurulum Tamamlandı!                 ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║                                                  ║"
echo "║  Uygulama:   http://localhost                    ║"
echo "║  API:        http://localhost/api                ║"
echo "║                                                  ║"
echo "║  Servis durumu:                                  ║"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
echo "║                                                  ║"
echo "║  Loglar için: docker compose logs -f             ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
