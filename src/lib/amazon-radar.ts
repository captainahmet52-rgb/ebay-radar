/**
 * AmazonBot Radar — kazanan ürün bulma beyni.
 * AliExpress + Amazon(Keepa) verisi alır → filtreler → skorlar → karar verir.
 * Veri kaynakları (AliExpress API / Keepa) ayrı; bu dosya SADECE karar mantığı (API'siz test edilebilir).
 *
 * CLAUDE.md: talep × kâr × düşük rekabet, jenerik/markasız hedef, marka/yasak SERT filtre.
 */

import {
  getReferralRate,
  calculateAmazonPrice,
  resolveMargin,
  AMAZON_MARKETS,
  type AmazonRepricerResult,
} from "./amazon-repricer";

// ─── Aday ürün (radar girişi) ─────────────────────────────────────────────────

export interface AmazonCandidate {
  // AliExpress tarafı
  aliId: string;
  title: string;
  aliCost: number;          // ürün maliyeti (USD — AliExpress kaynağı)
  aliShipping: number;      // kargo (USD)
  aliOrders: number;        // AliExpress sipariş sayısı (talep/güven sinyali)
  aliRating: number;        // 0-5
  brand?: string | null;    // Amazon "Brand" alanı (Keepa'dan)
  category?: string | null; // komisyon oranı için kategori anahtarı
  // Amazon tarafı (Keepa'dan gelecek; bilinmiyorsa null)
  amazonBsr?: number | null;        // Best Sellers Rank (düşük = çok satıyor)
  amazonSalesEst?: number | null;   // aylık satış tahmini
  amazonSellerCount?: number | null;
  amazonSoldByAmazon?: boolean;     // Amazon'un kendisi satıyor mu
}

// ─── Radar ayarları (eşikler — müşteri/admin ayarlayabilir) ──────────────────

export interface RadarConfig {
  market: string;        // us | uk | ae | sa
  targetMargin: number;  // hedef net marj — PAZAR BAŞINA (us 0.20, uk/ae 0.25, sa 0.30)
  minMarginPct: number;  // kabul edilen asgari gerçek marj % (örn 15)
  maxBsr: number;        // bunun üstü BSR elenir (örn 50000)
  minSalesEst: number;   // aylık min satış (örn 30)
  maxSellers: number;    // bundan fazla satıcı = çok rekabet (örn 15)
  minAliOrders: number;  // AliExpress min sipariş (örn 50)
  minAliRating: number;  // AliExpress min puan (örn 4.5)
  priceMin: number;      // satış fiyatı alt sınır (yerel para)
  priceMax: number;      // satış fiyatı üst sınır (yerel para)
}

/**
 * Pazardan bağımsız temel eşikler. targetMargin ve fiyat aralığı pazara göre
 * buildRadarConfig() içinde belirlenir (marj pazar varsayılanı, fiyat kura ölçeklenir).
 * priceMinUsd/priceMaxUsd USD referanstır; pazarın kuruyla yerel paraya çevrilir.
 */
export const DEFAULT_RADAR_CONFIG: Omit<RadarConfig, "market"> = {
  targetMargin: 0.20,
  minMarginPct: 15,
  maxBsr: 50000,
  minSalesEst: 30,
  maxSellers: 15,
  minAliOrders: 50,
  minAliRating: 4.5,
  priceMin: 12,
  priceMax: 80,
};

/** USD referans fiyat aralığı (pazarın kuruyla yerel paraya çevrilir). */
const PRICE_MIN_USD = 12;
const PRICE_MAX_USD = 80;

/**
 * Bir pazar için radar yapılandırması üretir.
 * - targetMargin: pazar varsayılanı (us %20, uk/ae %25, sa %30) — userMarginPct ile override
 * - priceMin/Max: USD aralığı pazarın kuruyla yerel paraya çevrilir
 */
export function buildRadarConfig(
  marketKey: string,
  opts?: { userMarginPct?: number | null; overrides?: Partial<Omit<RadarConfig, "market">> }
): RadarConfig {
  const market = AMAZON_MARKETS[marketKey];
  if (!market) throw new Error(`Geçersiz pazar: ${marketKey}`);

  const targetMargin = resolveMargin(market, opts?.userMarginPct);

  return {
    market: marketKey,
    ...DEFAULT_RADAR_CONFIG,
    targetMargin,
    priceMin: Math.round(PRICE_MIN_USD * market.fxRate),
    priceMax: Math.round(PRICE_MAX_USD * market.fxRate),
    ...opts?.overrides,
  };
}

// ─── Marka / yasak listeleri (SERT filtre — genişletilebilir) ────────────────

const BRAND_BLOCKLIST = [
  "nike", "adidas", "puma", "apple", "samsung", "sony", "lg", "huawei", "xiaomi",
  "disney", "marvel", "lego", "pokemon", "gucci", "louis vuitton", "chanel", "rolex",
  "bose", "jbl", "anker", "dyson", "gopro", "lacoste", "hugo boss", "north face",
];

const PROHIBITED_KEYWORDS = [
  "replica", "copy", "fake", "kopya", "taklit", "1:1",
  "airpods", "iphone", "galaxy", "playstation", "xbox", "nintendo",
  "weapon", "knife", "gun", "silah", "bıçak", "taser", "pepper spray",
  "cbd", "thc", "supplement", "viagra", "medicine", "ilaç",
  "lighter fluid", "battery pack 100wh", "recalled",
];

const PROHIBITED_CATEGORIES = [
  "weapons", "supplements", "medical", "drugs", "adult", "hazmat", "tobacco", "alcohol",
];

// ─── Tekil filtreler ──────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().trim();
}

export function checkBrandSafe(c: AmazonCandidate): { safe: boolean; reason?: string } {
  const brand = c.brand ? norm(c.brand) : "";
  const isGeneric = !brand || ["generic", "no brand", "unbranded", "oem", "noname"].includes(brand);

  if (!isGeneric && BRAND_BLOCKLIST.some((b) => brand.includes(b))) {
    return { safe: false, reason: `Markalı ürün (marka: ${c.brand})` };
  }
  const title = norm(c.title);
  const hit = BRAND_BLOCKLIST.find((b) => title.includes(b));
  if (hit) return { safe: false, reason: `Başlıkta marka geçiyor: "${hit}"` };

  return { safe: true };
}

export function checkAllowed(c: AmazonCandidate): { allowed: boolean; reason?: string } {
  const title = norm(c.title);
  const kw = PROHIBITED_KEYWORDS.find((k) => title.includes(k));
  if (kw) return { allowed: false, reason: `Yasaklı/riskli ibare: "${kw}"` };

  const cat = c.category ? norm(c.category) : "";
  if (cat && PROHIBITED_CATEGORIES.includes(cat)) {
    return { allowed: false, reason: `Yasaklı kategori: ${cat}` };
  }
  return { allowed: true };
}

// ─── Radar değerlendirmesi ────────────────────────────────────────────────────

export interface RadarVerdict {
  pass: boolean;
  score: number;            // 0-100 (yalnız geçerse anlamlı)
  reasons: string[];        // elenme sebepleri (varsa)
  pricing: AmazonRepricerResult | null;
}

export function evaluateCandidate(c: AmazonCandidate, config: RadarConfig): RadarVerdict {
  const reasons: string[] = [];
  const market = AMAZON_MARKETS[config.market];
  if (!market) {
    return { pass: false, score: 0, reasons: [`Geçersiz pazar: ${config.market}`], pricing: null };
  }

  // 1) Marka / yasak (SERT) — radar ön filtresi
  const brand = checkBrandSafe(c);
  if (!brand.safe) reasons.push(brand.reason!);
  const allowed = checkAllowed(c);
  if (!allowed.allowed) reasons.push(allowed.reason!);

  // 2) Kâr — pazarın KDV/gümrük/kuru + pazar marjıyla
  const referralRate = getReferralRate(c.category);
  const pricing = calculateAmazonPrice(
    c.aliCost, c.aliShipping, referralRate, market, config.targetMargin
  );
  if (pricing.marginPct < config.minMarginPct) {
    reasons.push(`Düşük marj (%${pricing.marginPct} < %${config.minMarginPct})`);
  }
  if (pricing.salePrice < config.priceMin || pricing.salePrice > config.priceMax) {
    reasons.push(`Fiyat aralık dışı (${market.symbol}${pricing.salePrice})`);
  }

  // 3) Talep (Amazon — biliniyorsa)
  if (c.amazonBsr != null && c.amazonBsr > config.maxBsr) {
    reasons.push(`BSR yüksek (${c.amazonBsr} > ${config.maxBsr}) — az satıyor`);
  }
  if (c.amazonSalesEst != null && c.amazonSalesEst < config.minSalesEst) {
    reasons.push(`Aylık satış düşük (${c.amazonSalesEst} < ${config.minSalesEst})`);
  }

  // 4) Rekabet
  if (c.amazonSoldByAmazon) reasons.push("Amazon'un kendisi satıyor — rekabet edilmez");
  if (c.amazonSellerCount != null && c.amazonSellerCount > config.maxSellers) {
    reasons.push(`Çok satıcı (${c.amazonSellerCount} > ${config.maxSellers})`);
  }

  // 5) Sourcing güvenilirliği (AliExpress)
  if (c.aliOrders < config.minAliOrders) {
    reasons.push(`AliExpress sipariş az (${c.aliOrders} < ${config.minAliOrders})`);
  }
  if (c.aliRating < config.minAliRating) {
    reasons.push(`AliExpress puan düşük (${c.aliRating} < ${config.minAliRating})`);
  }

  if (reasons.length > 0) {
    return { pass: false, score: 0, reasons, pricing };
  }

  return { pass: true, score: scoreCandidate(c, config, pricing), reasons: [], pricing };
}

// ─── Skorlama (0-100) ─────────────────────────────────────────────────────────
// Talep 40 + Marj 35 + Düşük rekabet 15 + Sourcing 10

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function scoreCandidate(c: AmazonCandidate, config: RadarConfig, pricing: AmazonRepricerResult): number {
  // Talep: BSR düşükse + satış yüksekse iyi
  let demand = 0.5;
  if (c.amazonBsr != null) demand = clamp01(1 - c.amazonBsr / config.maxBsr);
  if (c.amazonSalesEst != null) {
    const sales = clamp01(c.amazonSalesEst / (config.minSalesEst * 6));
    demand = (demand + sales) / 2;
  }

  // Marj: minMargin → 0, %40 → 1
  const margin = clamp01((pricing.marginPct - config.minMarginPct) / (40 - config.minMarginPct));

  // Rekabet: az satıcı iyi
  const competition = c.amazonSellerCount != null
    ? clamp01(1 - c.amazonSellerCount / config.maxSellers)
    : 0.5;

  // Sourcing: sipariş + puan
  const orders = clamp01(c.aliOrders / (config.minAliOrders * 10));
  const rating = clamp01((c.aliRating - 4) / 1);
  const sourcing = (orders + rating) / 2;

  const score = demand * 40 + margin * 35 + competition * 15 + sourcing * 10;
  return Math.round(score);
}

/** Aday listesini değerlendirip geçenleri skora göre sıralar. */
export function runRadar(
  candidates: AmazonCandidate[],
  config: RadarConfig
): Array<{ candidate: AmazonCandidate; verdict: RadarVerdict }> {
  return candidates
    .map((candidate) => ({ candidate, verdict: evaluateCandidate(candidate, config) }))
    .sort((a, b) => Number(b.verdict.pass) - Number(a.verdict.pass) || b.verdict.score - a.verdict.score);
}
