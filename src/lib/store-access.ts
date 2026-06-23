/**
 * Mağaza başına erişim/yaşam döngüsü kuralları.
 *
 * Akış:
 *   Bağlanma → 7 gün ücretsiz DENEME (50 ürün limiti), mağaza aktif
 *   Deneme bitince → otomatik DONDUR (paket al uyarısı)
 *   Paket alınca → +30 gün ÜCRETLİ aktif
 *   Paket süresi bitince → tekrar DONDUR
 */

export const STORE_TRIAL_DAYS = 7;
export const STORE_TRIAL_PRODUCT_LIMIT = 50;
export const STORE_SUBSCRIPTION_DAYS = 30;

/** Admin "comp" (bedava süresiz) için kullanılan uzak gelecek tarihi (yıl 2099). */
export const ADMIN_COMP_UNTIL = new Date("2099-12-31T00:00:00.000Z");

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

export type StoreAccessState = "trial" | "active" | "frozen";

interface AccessInput {
  trialEndsAt: Date | null;
  paidUntil: Date | null;
}

/** Mağazanın güncel erişim durumu (ücretli > deneme > dondurulmuş). */
export function storeAccessState(acc: AccessInput, now: Date = new Date()): StoreAccessState {
  if (acc.paidUntil && acc.paidUntil.getTime() > now.getTime()) return "active";
  if (acc.trialEndsAt && acc.trialEndsAt.getTime() > now.getTime()) return "trial";
  return "frozen";
}

/** Mağaza otomasyona dahil mi? (deneme veya ücretli süre içinde) */
export function hasStoreAccess(acc: AccessInput, now: Date = new Date()): boolean {
  return storeAccessState(acc, now) !== "frozen";
}

/** Denemenin bitmesine kalan gün sayısı (0 = bitti). */
export function trialDaysLeft(trialEndsAt: Date | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}
