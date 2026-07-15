// Paket tanımları — fiyatlandırma ve limitler
//
// MODEL: paket = MAĞAZA. Her paket TEK bir eBay mağazası içindir; birden fazla
// mağaza isteyen kullanıcı her mağaza için AYRI abonelik alır. Bu yüzden tüm
// paketlerde storeLimit = 1. Ürün/yükleme limitleri o mağazaya özeldir.

export const PLANS = {
  starter: {
    id:               "starter",
    name:             "Starter",
    priceMonthly:     29.90,
    productLimit:     300,
    uploadDailyLimit: 150,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  basic: {
    id:               "basic",
    name:             "Basic",
    priceMonthly:     59.90,
    productLimit:     1_000,
    uploadDailyLimit: 400,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  growth: {
    id:               "growth",
    name:             "Growth",
    priceMonthly:     99.90,
    productLimit:     3_000,
    uploadDailyLimit: 1_000,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  pro: {
    id:               "pro",
    name:             "Pro",
    priceMonthly:     149.90,
    productLimit:     5_000,
    uploadDailyLimit: 2_000,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  enterprise: {
    id:               "enterprise",
    name:             "Enterprise",
    priceMonthly:     249.90,
    productLimit:     10_000,
    uploadDailyLimit: 5_000,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  // ─── Pro+ (yüksek hacim) — ana grid'de DEĞİL, ayrı dropdown kartında gösterilir ───
  // Üst tier'larda marj scraper maliyetiyle sınırlı; DTS'e yakın fiyatlanır (hafif altında).
  scale: {
    id:               "scale",
    name:             "Pro+ 15K",
    priceMonthly:     399.90,
    productLimit:     15_000,
    uploadDailyLimit: 7_000,
    storeLimit:       1,
    trackingUnlimited: true,
  },
  ultimate: {
    id:               "ultimate",
    name:             "Pro+ 20K",
    priceMonthly:     519.90,
    productLimit:     20_000,
    uploadDailyLimit: 10_000,
    storeLimit:       1,
    trackingUnlimited: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

// Ana fiyat grid'inde gösterilen paketler (5 adet).
export const PLAN_LIST = [PLANS.starter, PLANS.basic, PLANS.growth, PLANS.pro, PLANS.enterprise];

// Pro+ yüksek hacim paketleri — ana grid'in altında ayrı kartta dropdown ile sunulur.
export const PRO_PLUS_PLANS = [PLANS.scale, PLANS.ultimate];

export function getPlan(planId: string) {
  return PLANS[planId as PlanId] ?? null;
}

// ─── Amazon paketleri (2026-07-15 kararı) ─────────────────────────────────────
// Amazon eBay'in fiyatlarını KOPYALAMIYOR — aynı ürün limitleri/mekanizma, ayrı
// fiyat. Sebep: Amazon tarafında stok/fiyat takibi resmi AliExpress API onayı
// gelene kadar ScrapingBee ile yapılıyor (bkz. src/lib/aliexpress-scraper.ts) —
// bu, ürün limiti büyüdükçe gerçek ve önemli bir maliyet demek (eBay'in ücretsiz
// SP-API'sinden farklı). +$50 düz ekleme bu geçici maliyet riskine karşı tampon;
// resmi API onaylanınca bu risk ortadan kalkar, fiyatlar o zaman yeniden gözden
// geçirilebilir. Lemon Squeezy'de eBay'inkinden AYRI 7 ürün/varyant gerekir
// (fiyata göre eşleşiyoruz — bkz. lemonsqueezy.ts).
export const AMAZON_PLANS = {
  starter: { ...PLANS.starter, priceMonthly: 69.90 },
  basic: { ...PLANS.basic, priceMonthly: 89.90 },
  growth: { ...PLANS.growth, priceMonthly: 119.90 },
  pro: { ...PLANS.pro, priceMonthly: 149.90 },
  enterprise: { ...PLANS.enterprise, priceMonthly: 209.90 },
  scale: { ...PLANS.scale, priceMonthly: 309.90 },
  ultimate: { ...PLANS.ultimate, priceMonthly: 389.90 },
} as const;

export const AMAZON_PLAN_LIST = [
  AMAZON_PLANS.starter, AMAZON_PLANS.basic, AMAZON_PLANS.growth,
  AMAZON_PLANS.pro, AMAZON_PLANS.enterprise,
];
export const AMAZON_PRO_PLUS_PLANS = [AMAZON_PLANS.scale, AMAZON_PLANS.ultimate];

export function getAmazonPlan(planId: string) {
  return AMAZON_PLANS[planId as PlanId] ?? null;
}

// Lemon Squeezy varyant ID → paket eşlemesi src/lib/lemonsqueezy.ts'te FİYATA göre
// otomatik çözülür (getVariantIdForPlan) — burada elle tutulan bir harita yok.

// ─── Trial Sistemi ────────────────────────────────────────────────────────────

export const TRIAL_DAYS = 7;
export const TRIAL_PRODUCT_LIMIT = 50;

export function isOnTrial(trialEndsAt: Date | null | undefined): boolean {
  if (!trialEndsAt) return false;
  return trialEndsAt > new Date();
}

export function trialDaysLeft(trialEndsAt: Date | null | undefined): number {
  if (!trialEndsAt) return 0;
  const diff = trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function hasActiveAccess(
  trialEndsAt: Date | null | undefined,
  subscriptionId: string | null | undefined
): boolean {
  return isOnTrial(trialEndsAt) || !!subscriptionId;
}

// ─── Mağaza Aktifleştirme Limitleri ───────────────────────────────────────────

/** Trial sırasında aktif edilebilecek mağaza sayısı (deneme için 1). */
export const TRIAL_STORE_LIMIT = 1;

/**
 * Kullanıcının kaç mağaza aktifleştirebileceğini döndürür.
 * Aktif abonelik varsa plana göre; sadece trial'daysa TRIAL_STORE_LIMIT;
 * ikisi de yoksa 0 (önce paket alması gerekir).
 */
export function storeLimitForUser(
  planId: string | null | undefined,
  trialEndsAt: Date | null | undefined,
  subscriptionId: string | null | undefined
): number {
  if (subscriptionId) {
    return getPlan(planId ?? "")?.storeLimit ?? 0;
  }
  if (isOnTrial(trialEndsAt)) {
    return TRIAL_STORE_LIMIT;
  }
  return 0;
}
