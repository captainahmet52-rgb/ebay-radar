# Sunucu Taşıma Runbook'u (Coolify → Coolify)

> Mevcut VPS'ten yeni VPS'e taşıma. Domain **aynı kalıyor** (`leanautomation.pro`) →
> eBay OAuth / RuName / webhook config'e **dokunulmaz**. Sadece DNS + env + DB taşınır.

## 🔴 İKİ HAYATİ KURAL (bunlar kaçarsa proje çöker)

1. **`TOKEN_ENCRYPTION_KEY` yeni sunucuda BİREBİR AYNI olacak.**
   eBay token'ları bununla AES-256-GCM şifreli. Farklı olursa tüm token'lar açılamaz →
   her müşteri eBay mağazasını yeniden bağlamak zorunda kalır.
2. **`NEXTAUTH_SECRET` de birebir aynı olacak.** Farklıysa tüm oturumlar düşer.

Bu ikisini eski Coolify env panelinden kopyala, yeni panele **aynen** yapıştır.

---

## 0) Ön hazırlık (cutover'dan ~1 gün önce)

- Domain sağlayıcısında `leanautomation.pro` A kaydının **TTL'ini 300 sn**'e düşür
  (geçişte hızlı yayılım için).
- Eski Coolify → app → **Environment Variables** sekmesini aç, tüm değerleri bir yere
  kopyala (özellikle 🔴 iki kritik anahtar).

---

## 1) Yeni Coolify: uygulamayı oluştur

- Yeni proje → **+ New Resource** → **Docker Compose** (Public/Private Repository)
- Repo: `captainahmet52-rgb/ebay-radar`, branch `main`
- Coolify `docker-compose.yml`'i otomatik okur. **Compose'u ELLE DÜZENLEME.**

> Not: compose kendi postgres + redis + app + worker + migrate + otomatik yedek
> servislerini içerir. Harici DB/Redis kurmana gerek yok.

---

## 2) Env var'ları gir (EN KRİTİK MANUEL İŞ)

Coolify env panelinde şunları eski sunucudan kopyala. Compose'da hardcoded olanlar
(`DATABASE_URL`, `REDIS_URL`, `SERVICE_FQDN_APP_3000`, `NODE_ENV`) **gerekmez**; gerisi lazım:

```
🔴 TOKEN_ENCRYPTION_KEY      (birebir aynı!)
🔴 NEXTAUTH_SECRET           (birebir aynı!)
   NEXTAUTH_URL              = https://leanautomation.pro
   CRON_SECRET
   SCRAPINGBEE_API_KEY
   EBAY_CLIENT_ID
   EBAY_CLIENT_SECRET
   EBAY_REDIRECT_URI
   EBAY_SANDBOX
   EBAY_WEBHOOK_VERIFICATION_TOKEN
   EBAY_DELETION_VERIFICATION_TOKEN
   EBAY_DELETION_ENDPOINT
   EBAY_FULFILLMENT_POLICY_ID
   EBAY_PAYMENT_POLICY_ID
   EBAY_RETURN_POLICY_ID
   EBAY_MERCHANT_LOCATION_KEY
   ETSYFLOW_SUPABASE_URL
   ETSYFLOW_SUPABASE_SERVICE_KEY
   NEXT_PUBLIC_ETSYFLOW_URL
   ALIEXPRESS_APP_KEY / _APP_SECRET / _ACCESS_TOKEN / _REFRESH_TOKEN / _GATEWAY / _SHIP_TO
   TRACKCAPTAIN_API_KEY
   SEVENTEENTRACK_API_KEY
   AFTERSHIP_API_KEY
   KEEPA_API_KEY
   AMAZON_LWA_CLIENT_ID / _LWA_CLIENT_SECRET / _SPAPI_APP_ID / _SPAPI_REDIRECT_URI
   NEXT_PUBLIC_SITE_URL     = https://leanautomation.pro
   NEXT_PUBLIC_APP_URL      = https://leanautomation.pro
   NEXT_PUBLIC_TAWK_ID
```

---

## 3) İlk deploy (boş DB)

- **Deploy** bas. Stack ayağa kalkar; `migrate` servisi Prisma migration'ları çalıştırıp
  **boş şema** kurar (tablolar var, veri yok).
- SSL sertifikası bu aşamada **alınamaz** (DNS hâlâ eski sunucuyu gösteriyor) — NORMAL.
  Geçici olarak Coolify'ın verdiği sslip.io domain'iyle test edeceğiz.

---

## 4) Yeni stack'i test et (DNS'e dokunmadan)

- Coolify app → **Domains** altındaki geçici `*.sslip.io` adresini aç.
- Giriş sayfası açılıyor mu, `/api/healthz` 200 mü kontrol et. (DB boş olduğu için
  içerik yok ama app ayakta olmalı.)

---

## 5) Veritabanını taşı (kullanıcılar, şifreli token'lar, siparişler)

Postgres container adını bul (Coolify kendi adını vermiş olabilir):

```bash
# ESKİ sunucuda:
OLD_PG=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1); echo "$OLD_PG"
```

Dökümü al:

```bash
# ESKİ sunucuda:
docker exec "$OLD_PG" pg_dump -U ebay_user -d ebay_db --clean --if-exists \
  | gzip > ~/lean_dump.sql.gz
ls -lh ~/lean_dump.sql.gz
```

Dosyayı yeni sunucuya kopyala (kendi makinenden ya da doğrudan):

```bash
scp root@ESKI_SUNUCU_IP:~/lean_dump.sql.gz ~/     # yeni sunucuya indir
# veya eski sunucudan: scp ~/lean_dump.sql.gz root@YENI_SUNUCU_IP:~/
```

Yeni DB'ye yükle:

```bash
# YENİ sunucuda:
NEW_PG=$(docker ps --format '{{.Names}}' | grep -i postgres | head -1); echo "$NEW_PG"
gunzip -c ~/lean_dump.sql.gz | docker exec -i "$NEW_PG" psql -U ebay_user -d ebay_db
```

Doğrula:

```bash
# YENİ sunucuda — kullanıcı sayısı eskisiyle aynı mı?
docker exec "$NEW_PG" psql -U ebay_user -d ebay_db -c 'SELECT count(*) FROM "User";'
docker exec "$NEW_PG" psql -U ebay_user -d ebay_db -c 'SELECT count(*) FROM "EbayAccount";'
```

> `--clean --if-exists`: dump, boş şemayı düşürüp verisiyle yeniden kurar. Migrate'in
> kurduğu boş tabloların üzerine yazar — sorun değil, dump tam şemayı taşır.

---

## 6) CUTOVER — kesintisiz geçiş

Split-brain (iki sunucunun aynı anda farklı DB'ye yazması) olmasın diye sıra önemli:

1. **Eski** Coolify → `app` ve `worker` servislerini **Stop** et (postgres'i DURDURMA).
2. **Son** dökümü al (Adım 5) → yeni DB'ye yükle (arada yeni sipariş geldiyse yakalanır).
3. Domain sağlayıcıda **A kaydını YENİ sunucu IP'sine** çevir.
4. DNS yayılınca (TTL 300sn) Coolify **SSL sertifikasını otomatik alır**. Alınmazsa yeni
   app'i bir kez **Redeploy** et.
5. `https://leanautomation.pro` → yeni sunucuda açılıyor + giriş çalışıyor mu doğrula.

---

## 7) Cutover sonrası doğrulama

- [ ] `https://leanautomation.pro` açılıyor, SSL yeşil
- [ ] Giriş yapılıyor (NEXTAUTH_SECRET taşındı)
- [ ] Bir kullanıcının eBay mağazası bağlı görünüyor (TOKEN_ENCRYPTION_KEY taşındı)
- [ ] `/api/healthz` → 200
- [ ] Admin → Radar paneli veriyi gösteriyor
- [ ] Worker çalışıyor (Coolify'da `worker` logs → "scheduler" / repeatable jobs kayıtlı)

---

## 8) Rollback (bir şey ters giderse)

DNS A kaydını **eski IP'ye geri** çevir → eski sunucu hâlâ ayakta (Adım 6'da sadece
app/worker durdurdun, postgres duruyor). Eski app/worker'ı **Start** et. TTL 300sn
olduğu için geri dönüş ~5 dk.

---

## 9) Temizlik (1-2 gün stabil çalıştıktan sonra)

- Eski VPS'i kapat / iptal et.
- Domain TTL'ini normale (3600sn) çıkar.
- `~/lean_dump.sql.gz` dosyalarını her iki sunucudan sil (şifreli token içerir).

---

## ⚠️ DOKUNMA (repo'da zaten doğru — Coolify'da compose editleme)

- `SERVICE_FQDN_APP_3000` satırını **silme** (Coolify port binding + SSL için şart).
- Compose'a custom **Traefik label / network** ya da `coolify` external network **ekleme**.
- `app`/`worker`'ı `migrate`'e **yeniden bağlama** (`depends_on: migrate` → 503 tuzağı).
- app healthcheck `start_period: 120s` — DDL migration'da RAM baskısını absorbe eder, azaltma.
