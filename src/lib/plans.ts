// Paket tanımları — fiyatlandırma ve limitler

export const PLANS = {
  starter: {
    id:               "starter",
    name:             "Starter",
    priceMonthly:     29.90,
    productLimit:     300,
    uploadDailyLimit: 150,
    trackingUnlimited: true,
  },
  basic: {
    id:               "basic",
    name:             "Basic",
    priceMonthly:     59.90,
    productLimit:     1_000,
    uploadDailyLimit: 400,
    trackingUnlimited: true,
  },
  growth: {
    id:               "growth",
    name:             "Growth",
    priceMonthly:     99.90,
    productLimit:     3_000,
    uploadDailyLimit: 1_000,
    trackingUnlimited: true,
  },
  pro: {
    id:               "pro",
    name:             "Pro",
    priceMonthly:     149.90,
    productLimit:     5_000,
    uploadDailyLimit: 2_000,
    trackingUnlimited: true,
  },
  enterprise: {
    id:               "enterprise",
    name:             "Enterprise",
    priceMonthly:     249.90,
    productLimit:     10_000,
    uploadDailyLimit: 5_000,
    trackingUnlimited: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const PLAN_LIST = Object.values(PLANS);

export function getPlan(planId: string) {
  return PLANS[planId as PlanId] ?? null;
}

// Paddle'dan gelen plan ID → bizim plan ID eşlemesi (Paddle entegrasyonunda doldurulacak)
export const PADDLE_PRICE_TO_PLAN: Record<string, PlanId> = {
  // "pri_xxx": "starter",
  // "pri_yyy": "basic",
  // ...
};
