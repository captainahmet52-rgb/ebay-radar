# Lean Automation — Amazon ASIN Grabber (v0.3.0)

Amazon'da kârlı ürünleri **filtrele** ve **ASIN'leri topla**. Tek tık kopyala → Lean Automation
panelinde "Toplu ASIN" ile yapıştır. **Sadece ASIN toplar — başka hiçbir şey yapmaz.**
eBay/Amazon otomasyonu, otomatik form doldurma, sahte tıklama vb. YOKTUR.

## Nasıl çalışır
1. Amazon'da bir **arama** yap (örn. `amazon.com/s?k=...`).
2. Sayfanın sağında **yüzen panel** açılır; ürün görsellerinin köşesinde **mor onay kutuları** çıkar.
3. Tek tek işaretle **veya** panelden **"Tümünü Seç"** ile sayfadaki tümünü (filtre varsa filtreye uyanları) seç.
4. **"Kopyala"** → ASIN listesi panoya kopyalanır.
5. Lean Automation paneline → "Toplu ASIN" → yapıştır → toplu içeri al.

## Panel kontrolleri
- **Tümünü Seç / Seçimi Kaldır / Kopyala / Listeyi Temizle**
- **Filtreler** (yalnız "Tümünü Seç" için): Min/Max Fiyat, Min Yorum, Min Puan, Teslimat (gün), Sadece Prime
  - Filtre varsa "Tümünü Seç" sayfadaki **tüm** ürünleri değil, **sadece kritere uyanları** işaretler.
  - Teslimat (gün) en iyi-çaba okunur (kart tarihi okunamazsa o ürün elenmez).
- Panel **sürüklenebilir**; ✕ ile kapatılır, sağdaki **LA** butonuyla tekrar açılır. Seçimler kalıcıdır.

## Kurulum (Load unpacked)
1. Chrome'da `chrome://extensions` aç → **Geliştirici modu** aç.
2. **"Paketlenmemiş öğe yükle"** → bu `extension/` klasörünü seç.
3. Çubuğa LA simgesi eklenir; Amazon'a gidince panel otomatik açılır.

## Notlar
- Manifest V3, izin: **storage** (sadece seçili ASIN'leri saklamak için). eBay izni/host'u yoktur.
- Tüm kod açık ve okunur (minified değil): `content/amazon.js`, `content/amazon.css`, `popup/`, `background.js`.
