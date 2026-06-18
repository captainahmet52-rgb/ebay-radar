/**
 * AmazonBot çekirdek motoru — AliExpress → Amazon fiyatlama (pazar-bazlı).
 * eBay repricer'ın (src/lib/repricer.ts) Amazon karşılığı.
 *
 * ÖNEMLİ: Her pazarın maliyeti farklıdır — farkı yaratan komisyon değil KDV'dir.
 *   US    → KDV yok
 *   UK    → satış %20 KDV (fiyata dahil) + Amazon ücretine %20 KDV
 *   UAE   → %5 KDV + %5 gümrük
 *   Suudi → %15 KDV + gümrük (düşük değer muafiyeti YOK)
 *
 * KDV'li pazarda fiyat KDV dahil gösterilir; KDV satıcının cebinden çıkar:
 *   satışFiyatı = landedCost / [ 1/(1+KDV) − komisyon×(1+ücretKDV) − marj ]
 *   landedCost  = (maliyet + kargo) × kur × (1 + gümrük)
 * Asgari komisyon (min referral) devreye girerse yeniden çözülür.
 *
 * Marj PAZAR BAŞINA ayarlanır (defaultMargin); kullanıcı kendi marjıyla override edebilir.
 */

export interface AmazonMarket {
  key: string;
  name: string;
  currency: string;
  symbol: string;
  /** Kategori yüzdesi bu tutarın altında kalırsa uygulanan asgari komisyon (yerel para). */
  minReferral: number;
  /** Satış KDV oranı — fiyata dahildir, satıcıdan tahsil edilir (US=0). */
  vatRate: number;
  /** Amazon komisyon/ücretine binen KDV (UK %20; UAE/SA kendi oranı; US=0). */
  feeVatRate: number;
  /** AliExpress paketi ülkeye girerken ithalat gümrüğü (yaklaşık). */
  customsDutyRate: number;
  /** USD → yerel para yaklaşık kuru. Üretimde canlı kurla değiştirilecek. */
  fxRate: number;
  /** Pazar varsayılan net kâr marjı (kullanıcı override edebilir). */
  defaultMargin: number;
}

// Değerler yaklaşıktır; üretimde pazar bazında Seller Central + canlı kurla doğrula.
export const AMAZON_MARKETS: Record<string, AmazonMarket> = {
  us: {
    key: "us", name: "Amazon US", currency: "USD", symbol: "$",
    minReferral: 0.30, vatRate: 0,    feeVatRate: 0,    customsDutyRate: 0,    fxRate: 1,    defaultMargin: 0.20,
  },
  uk: {
    key: "uk", name: "Amazon UK", currency: "GBP", symbol: "£",
    minReferral: 0.25, vatRate: 0.20, feeVatRate: 0.20, customsDutyRate: 0,    fxRate: 0.79, defaultMargin: 0.25,
  },
  ae: {
    key: "ae", name: "Amazon UAE (BAE)", currency: "AED", symbol: "AED ",
    minReferral: 1.0,  vatRate: 0.05, feeVatRate: 0.05, customsDutyRate: 0.05, fxRate: 3.67, defaultMargin: 0.25,
  },
  sa: {
    key: "sa", name: "Amazon Suudi Arabistan", currency: "SAR", symbol: "SAR ",
    minReferral: 1.0,  vatRate: 0.15, feeVatRate: 0.15, customsDutyRate: 0.05, fxRate: 3.75, defaultMargin: 0.30,
  },
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

/** Pazarın varsayılan marjı; kullanıcı yüzdesi (örn 30) verilirse onu kullan. */
export function resolveMargin(market: AmazonMarket, userMarginPct?: number | null): number {
  if (userMarginPct != null && userMarginPct > 0) return userMarginPct / 100;
  return market.defaultMargin;
}

/** Kullanıcının pazar başına marj override alanları (User'dan). */
export interface AmazonMarginOverrides {
  amazonMarginUsPct?: number | null;
  amazonMarginUkPct?: number | null;
  amazonMarginAePct?: number | null;
  amazonMarginSaPct?: number | null;
}

/** Pazar anahtarına karşılık gelen kullanıcı marj override'ını döner (yoksa null). */
export function userMarginForMarket(
  marketKey: string,
  o: AmazonMarginOverrides
): number | null {
  switch (marketKey) {
    case "us": return o.amazonMarginUsPct ?? null;
    case "uk": return o.amazonMarginUkPct ?? null;
    case "ae": return o.amazonMarginAePct ?? null;
    case "sa": return o.amazonMarginSaPct ?? null;
    default:   return null;
  }
}

export interface AmazonRepricerResult {
  /** Müşteriye gösterilen satış fiyatı (yerel para, KDV dahil). */
  salePrice: number;
  /** Amazon komisyonu (ücret KDV'si dahil, yerel para). */
  referralFee: number;
  /** Satıştan devlete gidecek KDV tutarı (yerel para). */
  vat: number;
  /** Ürün + kargo + kur + gümrük dahil maliyet (yerel para). */
  landedCost: number;
  /** Net kâr (yerel para). */
  netProfit: number;
  /** Gerçek net marj yüzdesi. */
  marginPct: number;
}

/**
 * Amazon satış fiyatını pazar-bazlı hesaplar (KDV + gümrük + kur dahil).
 * @param costUsd     AliExpress ürün maliyeti (USD)
 * @param shippingUsd AliExpress kargo (USD)
 * @param referralRate Amazon komisyon oranı (örn 0.15)
 * @param market      hedef pazar (KDV/gümrük/kur/min komisyon buradan)
 * @param margin      hedef net kâr marjı (örn 0.20); yoksa pazar varsayılanı
 */
export function calculateAmazonPrice(
  costUsd: number,
  shippingUsd: number,
  referralRate: number,
  market: AmazonMarket,
  margin: number = market.defaultMargin
): AmazonRepricerResult {
  // 1) Kaynak maliyeti yerel paraya çevir + ithalat gümrüğü ekle
  const landedCost = (costUsd + shippingUsd) * market.fxRate * (1 + market.customsDutyRate);

  // 2) KDV dahil fiyatı çöz
  const divisor = 1 / (1 + market.vatRate) - referralRate * (1 + market.feeVatRate) - margin;
  if (divisor <= 0) {
    throw new Error("KDV + komisyon + marj toplamı bu pazarda satışı imkansız kılıyor");
  }

  let salePrice = landedCost / divisor;
  let referralFee = salePrice * referralRate * (1 + market.feeVatRate);

  // 3) Asgari komisyon kontrolü (ücret KDV'si dahil), gerekirse yeniden çöz
  const minFee = market.minReferral * (1 + market.feeVatRate);
  if (referralFee < minFee) {
    const divisor2 = 1 / (1 + market.vatRate) - margin;
    salePrice = (landedCost + minFee) / divisor2;
    referralFee = minFee;
  }

  const netRevenue = salePrice / (1 + market.vatRate); // KDV hariç eline geçen
  const vat = salePrice - netRevenue;
  const netProfit = netRevenue - referralFee - landedCost;
  const marginPct = (netProfit / salePrice) * 100;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    salePrice: round2(salePrice),
    referralFee: round2(referralFee),
    vat: round2(vat),
    landedCost: round2(landedCost),
    netProfit: round2(netProfit),
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
