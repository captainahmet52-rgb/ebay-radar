// Radar karar denetimi — her eşleştirme kararını (kabul/inceleme/atla) özellikleriyle
// kaydeder. Amaç: kalibrasyon (eşikleri gerçek veriyle ayarlamak) ve "neden atladı?"
// görünürlüğü. Migration GEREKTİRMEZ — Redis'te kapaklı (capped) liste.

import type { RadarRedis } from "@/lib/radar/seller-profile";

const AUDIT_KEY = "radar:audit";
const MAX_AUDIT = 5000;

export interface RadarAuditEntry {
  ts: number;
  storeId: string;
  ebayTitle: string;
  ebayPrice: number | null;
  decision: "accept" | "review" | "skip";
  asin: string | null;
  contract: string | null;
  confidence: number;
  reason: string;
  priceRatio: number | null;
  candidateCount: number;
  // P5 para motoru sinyalleri (opsiyonel)
  soldCount?: number | null;
  competitiveness?: number | null;
  rankScore?: number;
}

/** Bir radar kararını denetim kaydına ekler (kapaklı liste). Asla throw etmez. */
export async function recordRadarDecision(
  redis: RadarRedis,
  entry: RadarAuditEntry,
): Promise<void> {
  try {
    await redis.lpush(AUDIT_KEY, JSON.stringify(entry));
    await redis.ltrim(AUDIT_KEY, 0, MAX_AUDIT - 1);
  } catch {
    /* denetim kaydı kritik değil — sessiz geç */
  }
}

/** Son N denetim kaydını döndürür (en yeni önce). Hata → boş dizi. */
export async function readRecentDecisions(
  redis: RadarRedis,
  limit = 200,
): Promise<RadarAuditEntry[]> {
  try {
    const raw = await redis.lrange(AUDIT_KEY, 0, Math.max(0, limit - 1));
    const out: RadarAuditEntry[] = [];
    for (const s of raw) {
      try {
        out.push(JSON.parse(s) as RadarAuditEntry);
      } catch {
        /* bozuk satırı atla */
      }
    }
    return out;
  } catch {
    return [];
  }
}
