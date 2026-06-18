/**
 * AmazonBot çekirdek motoru — AliExpress → Amazon fiyatlama.
 * eBay repricer'ın (src/lib/repricer.ts) Amazon karşılığı.
 *
 * Formül: amazon_fiyatı = (maliyet + kargo) / (1 - komisyon - marj)
 * Asgari komisyon (min referral) devreye girerse yeniden çözülür.
 */

export interface AmazonMarket {
  key: string;
  name: string;
  currency: string;
  symbol: string;
  /** Kategori yüzdesi bu tutarın altında kalırsa uygulanan asgari komisyon. */
  minReferral: number;
}

// Değerler yaklaşıktır; üretimde pazar bazında Amazon Seller Central'dan doğrula.
export const AMAZON_MARKETS: Record<string, AmazonMarket> = {
  us: { key: "us", name: "Amazon US",                currency: "USD", symbol: "$",     minReferral: 0.30 },
  uk: { key: "uk", name: "Amazon UK",                currency: "GBP", symbol: "£",     minReferral: 0.25 },
  ae: { key: "ae", name: "Amazon UAE (BAE)",         currency: "AED", symbol: "AED ",  minReferral: 1.0 },
  sa: { key: "sa", name: "Amazon Suudi Arabistan",   currency: "SAR", symbol: "SAR ",  minReferral: 1.0 },
};

// Amazon kategori komisyon oranları (2026, ~dondurulmuş). Yaklaşık referans.
export const AMAZON_CATEGORY_FEES: Record<string, number> = {
  electronics:   0.08,
  computers:     0.08,
  "video-games": 0.15,
  home:          0.15,
  kitchen:       0.15,
  toys:          0.15,
  beauty:        0.15,
  sports:        0.15,
  pet:           0.15,
  shoes:         0.15,
  clothing:      0.17,
  watches:       0.16,
  jewelry:       0.20,
};

export const DEFAULT_REFERRAL = 0.15;
export const DEFAULT_MARGIN = 0.20;

export function getReferralRate(category?: string | null): number {
  if (!category) return DEFAULT_REFERRAL;
  return AMAZON_CATEGORY_FEES[category.toLowerCase()] ?? DEFAULT_REFERRAL;
}

export interface AmazonRepricerResult {
  salePrice: number;
  referralFee: number;
  netProfit: number;
  marginPct: number;
}

/**
 * Amazon satış fiyatını hesaplar.
 * @param cost AliExpress ürün maliyeti (pazar para biriminde)
 * @param shipping AliExpress kargo
 * @param referralRate Amazon komisyon oranı (örn 0.15)
 * @param minReferral asgari komisyon tutarı
 * @param margin hedef net kâr marjı (örn 0.20)
 */
export function calculateAmazonPrice(
  cost: number,
  shipping: number,
  referralRate: number,
  minReferral: number,
  margin: number = DEFAULT_MARGIN
): AmazonRepricerResult {
  const divisor = 1 - referralRate - margin;
  if (divisor <= 0) {
    throw new Error("komisyon + marj toplamı 1'e eşit/büyük olamaz");
  }

  let salePrice = (cost + shipping) / divisor;
  let referralFee = salePrice * referralRate;

  // Yüzde komisyon asgariden düşükse, asgari komisyonla yeniden çöz
  if (referralFee < minReferral) {
    salePrice = (cost + shipping + minReferral) / (1 - margin);
    referralFee = minReferral;
  }

  const netProfit = salePrice - cost - shipping - referralFee;
  const marginPct = (netProfit / salePrice) * 100;

  return {
    salePrice: Math.round(salePrice * 100) / 100,
    referralFee: Math.round(referralFee * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    marginPct: Math.round(marginPct * 10) / 10,
  };
}

// ─── Stok kuralı (AliExpress kaynaklı — eBay mantığıyla aynı) ─────────────────

export type AliStockStatus = "in_stock" | "low" | "out" | "unknown";

/**
 * AliExpress stok durumuna göre Amazon adedi.
 * in_stock → 2, low(≥3) → 1, low(<3)/out/unknown → 0 (duraklat).
 */
export function determineAmazonQty(status: AliStockStatus, qty: number | null | undefined): number {
  if (status === "out" || status === "unknown") return 0;
  if (status === "low") return (qty ?? 0) >= 3 ? 1 : 0;
  return 2; // in_stock
}

/** Fiyat spike kontrolü — %50'den fazla artış → spike (güncellemeyi duraklat). */
export function isPriceSpike(oldPrice: number, newPrice: number): boolean {
  if (oldPrice <= 0) return false;
  return (newPrice - oldPrice) / oldPrice > 0.5;
}
