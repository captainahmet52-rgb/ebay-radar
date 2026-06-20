# Lean Automation — Chrome Eklentisi (v0.1.0)

Amazon'da kârlı ürünleri bulup ASIN'lerini toplayan tarayıcı eklentisi.
İlk sürüm: **Amazon Ürün Bulucu (ASIN Grabber)** — bağımsız çalışır, backend gerekmez.

## Kurulum (test — "Load unpacked")
1. Chrome'da `chrome://extensions` aç
2. Sağ üstten **Geliştirici modu**'nu aç
3. **"Paketlenmemiş öğe yükle"** → bu `extension/` klasörünü seç
4. Eklenti çubuğa eklenir (LA simgesi)

## Kullanım
1. Amazon'da bir **arama** yap (örn. amazon.com/s?k=...)
2. Ürünlerin köşesinde **mor onay kutuları** çıkar — kârlı gördüklerini işaretle
3. Eklenti simgesine tıkla → panelde:
   - Seçili ASIN'leri görürsün (kalıcı, sayfa kapansa da durur)
   - **Filtreler** (fiyat/yorum/puan/Prime) + **Tümünü Seç** → kritere uyanları toplu işaretler
   - **Kopyala** → ASIN listesini panoya alır (Lean Automation paneline "Toplu ASIN" ile yapıştır)
   - **Listeyi Temizle**

## Yol haritası (sonraki sürümler)
- [ ] Lean Automation hesabıyla giriş (backend bağlama)
- [ ] "eBay'e Yükle" — seçilenleri doğrudan panele/eBay'e gönder
- [ ] Satışta Amazon'dan oto-sipariş + takip kodu çekme
- [ ] eBay/Etsy araçları

## Notlar
- Manifest V3, izinler: storage, tabs, scripting + Amazon host'ları
- Tüm kod açık ve okunur (minified değil) — `content/amazon.js`, `popup/`, `background.js`
