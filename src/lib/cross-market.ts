// Çapraz pazar + uluslararası satış maliyet modeli.
//
// KAYNAK (2026-07'de resmi eBay sayfasından doğrulandı):
// https://www.ebay.com/help/selling/fees-credits-invoices/international-fees-ebay-global-sellers?id=5224
//
// 1) eBay ULUSLARARASI İŞLEM ÜCRETİ (International fee)
//    Alıcının ülkesi/teslimat adresi, satıcının eBay KAYIT ülkesinden farklıysa
//    satış TOPLAMI üzerinden kesilir. Oran satıcının kayıt ülkesine göredir:
//      Türkiye → "Rest of World" = %1.55  ← varsayılanımız (müşteri tabanı TR)
//      Japonya %1.35 · G.Kore %1.45 · Hindistan %1.70 · Yeni Zelanda %1.00
//      APAC %1.30 · Avrupa AB-dışı %1.30 · ABD kayıtlı → yerel satışta 0
//    TR kayıtlı satıcı eBay US/UK/DE'de satarken alıcı hemen her zaman yabancı
//    olduğundan bu ücret HER satışta var sayılır. Kayıt ülkesi farklıysa
//    kullanıcı panelden oranı değiştirir (ör. ABD kayıtlıysa 0 yazar).
//
// 2) eBay KUR ÇEVRİM ÜCRETİ (Seller currency conversion charge)
//    İlan para birimi ≠ payout para birimi ise eBay baz kurun üstüne sabit
//    yüzde koyar: TR dahil çoğu ülke %3.0 (Malezya/İsrail %2.5, LatAm %3.5).
//    Payout USD varsayılır → yalnız USD-dışı pazarlarda (UK/DE) uygulanır.
//
// 3) KAYNAK TARAFI ÇAPRAZ MALİYET (Amazon pazarı ≠ eBay pazarı ülkesi)
//    Amazon uluslararası kargo + gümrük/import ürüne ve ağırlığa göre değişir;
//    statik bilinemez → kullanıcı kalibre eder: yüzde tampon + sabit tampon
//    (SABİT tampon kaynak pazarın para birimindedir, fiyatla birlikte çevrilir).

export const DEFAULT_EBAY_INTL_FEE_PCT = 1.55; // TR kayıt — eBay "Rest of World"
export const DEFAULT_EBAY_FX_FEE_PCT = 3.0; // TR — "All other eBay global countries"

// Amazon kaynak pazarı → ülke kodu
const AMAZON_MARKET_COUNTRY: Record<string, string> = {
  US: "US",
  UK: "GB",
  DE: "DE",
  CA: "CA",
};

// eBay satış pazarı → ülke kodu
const EBAY_SITE_COUNTRY: Record<string, string> = {
  EBAY_US: "US",
  EBAY_GB: "GB",
  EBAY_DE: "DE",
};

// eBay pazarının para birimi USD'den farklı mı? (payout USD varsayımı ile
// kur çevrim ücretinin uygulanacağı pazarlar)
const EBAY_SITE_NON_USD: Record<string, boolean> = {
  EBAY_US: false,
  EBAY_GB: true,
  EBAY_DE: true,
};

/** Ürünün Amazon kaynağı ile eBay satış pazarı farklı ülkede mi? */
export function isCrossMarket(
  amazonMarket?: string | null,
  ebaySite?: string | null
): boolean {
  const src = AMAZON_MARKET_COUNTRY[(amazonMarket ?? "US").toUpperCase()] ?? "US";
  const dst = EBAY_SITE_COUNTRY[ebaySite ?? "EBAY_US"] ?? "US";
  return src !== dst;
}

/** Kullanıcının panelden ayarladığı uluslararası maliyet alanları (User modeli). */
export interface IntlCostSettings {
  ebayIntlFeePct?: number | null;
  ebayFxFeePct?: number | null;
  crossExtraPct?: number | null;
  crossExtraFixed?: number | null;
}

export interface ExtraCosts {
  /** Satış fiyatına ORANLA ek kesinti toplamı (ör. 0.0455 = %4.55). */
  extraRate: number;
  /** Kaynak maliyetine eklenecek SABİT tutar (kaynak pazar para biriminde). */
  extraSourceFixed: number;
}

/**
 * Kullanıcı ayarları + (kaynak pazar, satış pazarı) ikilisinden repricer'a
 * girecek ek maliyetleri üretir. Ayar objesi yoksa güvenli TR varsayımları
 * kullanılır (intl %1.55; USD-dışı pazarda +%3 kur; çapraz tamponlar 0).
 */
export function resolveExtraCosts(
  settings: IntlCostSettings | null | undefined,
  amazonMarket?: string | null,
  ebaySite?: string | null
): ExtraCosts {
  const intlPct = settings?.ebayIntlFeePct ?? DEFAULT_EBAY_INTL_FEE_PCT;
  const fxPct = settings?.ebayFxFeePct ?? DEFAULT_EBAY_FX_FEE_PCT;
  const crossPct = settings?.crossExtraPct ?? 0;
  const crossFixed = settings?.crossExtraFixed ?? 0;

  // Uluslararası işlem ücreti — kayıt ülkesi TR varsayımıyla her satışta
  let extraRate = Math.max(0, intlPct) / 100;

  // Kur çevrim ücreti — yalnız ilan para birimi USD değilse (payout USD)
  if (EBAY_SITE_NON_USD[ebaySite ?? "EBAY_US"]) {
    extraRate += Math.max(0, fxPct) / 100;
  }

  // Kaynak tarafı çapraz maliyetler — yalnız Amazon pazarı ≠ eBay pazarı ülkesi
  let extraSourceFixed = 0;
  if (isCrossMarket(amazonMarket, ebaySite)) {
    extraRate += Math.max(0, crossPct) / 100;
    extraSourceFixed = Math.max(0, crossFixed);
  }

  return { extraRate, extraSourceFixed };
}
