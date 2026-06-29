// Satıcıya-özel marj profili — her takip edilen mağaza Amazon maliyetinin üstüne
// kendi tutarlı marjını koyar. Kabul edilen eşleşmelerin amazon/ebay oranlarından
// (log uzayında medyan ± 2.5·MAD) o satıcıya özel HASSAS fiyat bandı öğrenilir.
//
// GÜVENLİK: öğrenilen bant yalnızca global mutlak bandın [0.25,0.95] İÇİNE daraltır,
// asla genişletmez (geri besleme kaçağına karşı). Yeterli örnek yoksa global bant kalır.

import {
  PRICE_ABS_MIN,
  PRICE_ABS_MAX,
  type PriceBand,
} from "@/lib/radar/source-matcher";

// Bant öğrenmek için gereken minimum kabul örneği (altında global bant kullanılır).
export const MIN_SAMPLES = 12;
// Saklanacak son oran sayısı (kayan pencere).
export const MAX_SAMPLES = 200;
// Medyan etrafında kaç MAD genişlik (robust ±2.5σ ≈ 2.5·1.4826·MAD).
const MAD_WIDTH = 2.5;
const MAD_SCALE = 1.4826; // MAD → σ tutarlılık katsayısı

const REDIS_KEY = (storeId: string) => `radar:seller:${storeId}:logratios`;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

/** Median Absolute Deviation. */
export function mad(values: number[], med = median(values)): number {
  if (values.length === 0) return 0;
  return median(values.map((v) => Math.abs(v - med)));
}

/**
 * Log-oran örneklerinden satıcıya-özel hassas bant. SAF — Redis'siz test edilebilir.
 * Örnek azsa fallback döner. Sonuç daima global mutlak banda kıstırılır.
 */
export function computeBandFromLogRatios(logRatios: number[], fallback: PriceBand): PriceBand {
  if (logRatios.length < MIN_SAMPLES) return fallback;

  const med = median(logRatios);
  const dispersion = mad(logRatios) * MAD_SCALE;
  // MAD 0 olabilir (çok tutarlı satıcı) → küçük taban genişlik ver.
  const halfWidth = Math.max(dispersion * MAD_WIDTH, 0.05);

  let min = Math.exp(med - halfWidth);
  let max = Math.exp(med + halfWidth);

  // Global mutlak bandın içine kıstır + fallback'ten daha geniş olmasın (yalnız daralt).
  min = Math.max(min, PRICE_ABS_MIN, fallback.min);
  max = Math.min(max, PRICE_ABS_MAX, fallback.max);

  // Dejenere durum (min >= max) → fallback.
  if (!(min < max)) return fallback;
  return { min, max };
}

// ─── Redis I/O (enjekte edilen minimal istemci) ──────────────────────────────
export interface RadarRedis {
  lpush(key: string, value: string): Promise<number>;
  ltrim(key: string, start: number, stop: number): Promise<unknown>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
}

/** Kabul edilen bir eşleşmenin amazon/ebay oranını satıcı profiline ekler. */
export async function recordSellerRatio(
  redis: RadarRedis,
  storeId: string,
  ratio: number,
): Promise<void> {
  if (!(ratio > 0) || !Number.isFinite(ratio)) return;
  // mantıksız oranları kaydetme (mutlak bant dışı) — profili kirletmesin
  if (ratio < PRICE_ABS_MIN || ratio > PRICE_ABS_MAX) return;
  try {
    const key = REDIS_KEY(storeId);
    await redis.lpush(key, String(Math.log(ratio)));
    await redis.ltrim(key, 0, MAX_SAMPLES - 1);
  } catch {
    /* profil yazımı kritik değil — sessiz geç */
  }
}

/** Satıcının öğrenilmiş hassas bandını döndürür (yetersiz veri → fallback). */
export async function getSellerPriceBand(
  redis: RadarRedis,
  storeId: string,
  fallback: PriceBand,
): Promise<PriceBand> {
  try {
    const raw = await redis.lrange(REDIS_KEY(storeId), 0, MAX_SAMPLES - 1);
    const logRatios = raw
      .map((s) => parseFloat(s))
      .filter((n) => Number.isFinite(n));
    return computeBandFromLogRatios(logRatios, fallback);
  } catch {
    return fallback;
  }
}
