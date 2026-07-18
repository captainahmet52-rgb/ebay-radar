# Lean Automation — Yol Haritası Notları

Bu dosya sahibin uzun vadeli platform kararlarını kodun yanında tutar
(detaylı güncel iş listesi Claude hafızasında: pending-tasks).

## 🛒 Walmart Otomasyonu — EN SON, ama KESİN yapılacak

**Sahibin kararı (2026-07-18):** "Dünyada şu anda yok — her şey bitince en son
Walmart lazım bize."

- **Sıra:** Mevcut işler bittikten sonra (Shopify canlı testi → App Store başvurusu →
  UGC video render motoru → İngilizce/i18n) → **Walmart**.
- **Mimari:** Yeni kanal = mevcut ortak depo desenini aynalar (AliExpress ortak havuzu →
  kanal listelemesi → stok/fiyat senkron worker'ları → sipariş çekme). Amazon/Shopify
  motorları şablon; `WalmartAccount` + `WalmartListing` + `walmart-*` worker'ları.
- **Araştırılacak:** Walmart Marketplace API (Seller Center) onay süreci — Walmart
  satıcı başvurusu ABD işletmesi/EIN isteyebilir → şirket kurulumuyla birlikte
  değerlendirilecek. Dropshipping politikası kontrol edilecek.
- **Neden değerli:** Bu kanal kombinasyonunu (eBay + Amazon + Etsy + Shopify + Walmart,
  tek ortak depo) sunan rakip bilinmiyor.

## Kanal sırası (mevcut durum)

| Kanal | Durum |
|---|---|
| eBay | Canlı motor (gerçek uçtan uca test bekliyor) |
| Amazon | Motor hazır (SP-API onayı şirket sonrası) |
| Etsy | EtsyFlow köprüsü hazır, panel iskelet |
| Shopify | Kod TAMAM — Partner hesabı + dev store testi + App Store bekliyor |
| **Walmart** | **PLANLANDI — en son** |
