# Otomasyon Sistemi — Oturum Kayıtları

Bu dosya, her oturumda yapılan önemli değişiklikleri ve keşfedilen sorunları kaydeder.
Yeni bir oturum başladığında bu dosya okunmalı ve mevcut durum anlaşılmalı.


---

## 2026-09-01 — Otomatik Yükleme (eBay) Düzeltmeleri

### Sorun
Kullanıcı "Şimdi Çalıştır" butonuna bastığında "Önce oto-yüklemeyi açıp ayarları kaydet" hatası alıyordu —
hafta o sırada otomatik yükleme açıktı.

### Kök Sebep
Run endpoint'inde `autoUploadEnabled` false ise job eklemiyordu. Kullanıcı toggle'ı açmış ama
"Kaydet"e basmamış olabilir (race condition) ya da kaydetme sessizce başarısız olmuş olabilir.

### Yapılan Değişiklikler

#### 1. `src/app/api/auto-upload/run/route.ts`
- **Eski:** `autoUploadEnabled` false ise 400 hatası dönüyordu
- **Yeni:** `autoUploadEnabled` false ise otomatik olarak `true` yapıyor
- **Neden:** "Şimdi Çalıştır" her zaman çalışsın; zaten job'u ekliyor, worker kendi kontrolünü yapıyor

#### 2. `src/lib/auto-upload-schedule.ts`
- **Eski:** `daily`/`weekly` zamanlamalarda SADECE seçilen saatte çalışıyordu
  - `hourMatches && hoursSinceLastRun >= 20`
- **Yeni:** 20+ saat geçmişse herhangi bir saatte çalışır
  - `hoursSinceLastRun >= 20` (saat eşleşmesi aranmıyor)
- **Neden:** Scheduler saatte bir çalışıyor. Eğer seçilen saat kaçırıldıysa (deploy, restart, crash) →
  kullanıcı 24+ saat bekliyordu. Artık catch-up mantığıyla çalışır.

#### 3. `src/app/dashboard/auto-upload/page.tsx`
- **Eklenen:** Sayfanın en üstünde durum banner'ı
  - 🟢 "Otomatik yükleme aktif" (toggle açıksa)
  - 🔴 "Kapalı — açıp Kaydet'e basın" (toggle kapalıysa)
  - Son çalışma bilgisi (tarih + ürün sayısı)
- **Eklenen:** Toggle altında açıklayıcı metin ("✅ Açık — zamanlanmış yükleme aktif")
- **Eklenen:** Geçmiş tablosunda hata mesajları (errorMessage sütunu)
- **Eklenen:** Kaydet butonu toast mesajı iyileştirildi ("Kaydetme başarısız — tekrar deneyin")

#### 4. `worker/jobs/ebay-auto-upload.ts`
- **Eklenen:** Depo boşsa filtre detaylarını errorMessage olarak kaydet
  - "Filtrelere uyan ürün yok (pazar: US, fiyat: $0–$150, son 7 gün)"
- **Değişen:** Boş depo durumunda status "partial" yerine "success" (zaten ürün yok, hata değil)

### Test Sonuçları
- 124 test: ✅ tamamı geçti
- `auto-upload-schedule.test.ts`: ✅ 6/6 test geçti
- TypeScript build: ✅ hata yok

### Deploy
- Commit: `f4b54f8` → `fix: oto-yükleme — "Şimdi Çalıştır" hatası + zamanlama + UI iyileştirmeleri`
- Push: `main` branch'e push edildi
- Coolify otomatik deploy başlattı

### Bilinen Potansiyel Sorun
Depo ürünlerinin filtrelere uymaması → "0 ürün yüklendi"
- `uploadSoldWithinDays` (varsayılan 7): `lastSoldAt` dolu değilse hiçbir ürün uymaz
- `amazonPrice: { not: null }`: Fiyatı olmayan ürünler elenir
- `amazonMarket`: Kullanıcının seçtiği market ile depo ürünleri eşleşmeli
- **Çözüm:** Kullanıcı "Satış Aktivitesi" filtresini "Filtre yok" olarak değiştirebilir

### Takip
- [ ] Deploy sonrası canlı test yapılacak
- [ ] Admin panelinden depo ürün sayısı kontrol edilecek
- [ ] Worker logları kontrol edilecek (`docker logs ebay_worker --tail 50`)

---

## 2026-09-01 — Coolify Deploy Hatası Düzeltmesi

### Sorun
Coolify deploy logu:
```
Deployment failed: Failed to read the Docker Compose file from the repository.
```

### Kök Sebep
1. `docker-compose.yml` yorum satırlarında Türkçe özel karakterler (ş,ı,ğ,ü,öç), emoji'ler ve
   box-drawing karakterleri (`─`, `→`) vardı — bazı Coolify YAML parse'ları bunları hata veriyordu
2. Coolify V2 varsayılan olarak `compose.yaml` arar, `docker-compose.yml` bulamaz

### Yapılan Değişiklikler

#### 1. `compose.yaml` — YENİ DOSYA
- `docker-compose.yml`'in temiz versiyonu (yorumsuz, special karaktersiz)
- Coolify V2'nin varsayılan aradığı dosya adı

#### 2. `docker-compose.yml` — temizlendi
- Yorumlardaki Türkçe karakterler, emoji'ler ve box-drawing karakterleri kaldırıldı
- Yorumlar ASCII-only (İngilizce) olarak yeniden yazıldı
- Docker Compose config ile validate edildi: ✅ VALID

### Test Sonuçları
- `docker compose -f docker-compose.yml config`: ✅ VALID
- `docker compose -f compose.yaml config`: ✅ VALID
- 124 unit test: ✅ tamamı geçti

### Deploy
- Commit: `dcdf4e9` → `fix: add compose.yaml for Coolify V2 + clean docker-compose.yml comments`
- Push: `main` branch'e push edildi
- Coolify otomatik deploy başlattı

### Ders
- Windows'ta `core.autocrlf = true` var, git CRLF/LF dönüşümü yapıyor
- Coolify Linux'ta çalışıyor — dosyalar LF olmalı (git bu zaten normalize ediyor)
- Docker Compose dosyalarında comment'ler mümkün olduğunca ASCII-only olmalı
- Her zaman `compose.yaml` (V2 standardı) da bulundur

---
