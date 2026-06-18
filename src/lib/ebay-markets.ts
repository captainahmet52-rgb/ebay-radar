/**
 * eBay pazar yerleri — ücret yapısı PAZAR BAŞINA farklıdır.
 * Amazon'daki AMAZON_MARKETS'in eBay karşılığı.
 *
 * Önemli farklar (2026):
 *   US → eBay ücretine KDV yok, düzenleme ücreti yok
 *   UK → eBay ücretlerine %20 KDV (Ağu 2024'ten beri) + %0.35 Düzenleme Ücreti (Regulatory Operating Fee)
 *   DE → eBay ücretlerine %19 KDV + düzenleme ücreti, sipariş ücreti EUR
 *   AU → eBay ücretlerine %10 GST
 *
 * Etkin ücret = (FVF + düzenleme ücreti) × (1 + ücretKDV)
 * Sipariş başına sabit ücret de yerel parada ve ücretKDV'ye tabidir.
 */

export interface EbayMarketplace {
  key: string;             // EBAY_US (eBay Identity registrationMarketplaceId ile aynı)
  name: string;
  currency: string;        // USD
  symbol: string;
  /** Kategori komisyonu (Product.ebayFeeRate) yoksa kullanılan varsayılan FVF. */
  defaultFvfRate: number;
  /** Sipariş başına sabit ücret — eşik üstü (yerel para, KDV hariç). */
  perOrderFeeHigh: number;
  /** Sipariş başına sabit ücret — eşik altı (yerel para, KDV hariç). */
  perOrderFeeLow: number;
  /** Sabit ücret eşiği (yerel para). */
  perOrderThreshold: number;
  /** eBay ücretlerine binen KDV/GST oranı (US=0, UK=0.20, DE=0.19, AU=0.10). */
  feeVatRate: number;
  /** Düzenleme/regülasyon ücreti oranı (UK %0.35; çoğu pazarda 0). */
  regulatoryFeeRate: number;
}

export const EBAY_MARKETPLACES: Record<string, EbayMarketplace> = {
  EBAY_US: {
    key: "EBAY_US", name: "eBay US", currency: "USD", symbol: "$",
    defaultFvfRate: 0.1325, perOrderFeeHigh: 0.40, perOrderFeeLow: 0.30, perOrderThreshold: 10,
    feeVatRate: 0, regulatoryFeeRate: 0,
  },
  EBAY_GB: {
    key: "EBAY_GB", name: "eBay UK", currency: "GBP", symbol: "£",
    defaultFvfRate: 0.129, perOrderFeeHigh: 0.40, perOrderFeeLow: 0.30, perOrderThreshold: 10,
    feeVatRate: 0.20, regulatoryFeeRate: 0.0035,
  },
  EBAY_DE: {
    key: "EBAY_DE", name: "eBay Almanya", currency: "EUR", symbol: "€",
    defaultFvfRate: 0.11, perOrderFeeHigh: 0.45, perOrderFeeLow: 0.35, perOrderThreshold: 10,
    feeVatRate: 0.19, regulatoryFeeRate: 0.004,
  },
  EBAY_AU: {
    key: "EBAY_AU", name: "eBay Avustralya", currency: "AUD", symbol: "A$",
    defaultFvfRate: 0.134, perOrderFeeHigh: 0.40, perOrderFeeLow: 0.30, perOrderThreshold: 10,
    feeVatRate: 0.10, regulatoryFeeRate: 0,
  },
};

export const DEFAULT_EBAY_MARKETPLACE = "EBAY_US";

/** Site anahtarından pazar nesnesi (bilinmiyorsa US). */
export function resolveEbayMarketplace(site?: string | null): EbayMarketplace {
  if (site && EBAY_MARKETPLACES[site]) return EBAY_MARKETPLACES[site];
  return EBAY_MARKETPLACES[DEFAULT_EBAY_MARKETPLACE];
}

/**
 * eBay Identity API'nin döndürdüğü registrationMarketplaceId'yi desteklenen
 * anahtara çevirir. Desteklenmeyen pazarsa güvenli varsayılan: EBAY_US.
 */
export function normalizeEbayMarketplaceId(id?: string | null): string {
  if (id && EBAY_MARKETPLACES[id]) return id;
  return DEFAULT_EBAY_MARKETPLACE;
}
