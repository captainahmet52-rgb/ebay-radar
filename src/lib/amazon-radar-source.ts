// AmazonBot radar KAYNAĞI — radarın "beynine" (amazon-radar.ts) beslenecek aday
// ürünleri getirir. AliExpress bağlıysa canlı keşif; değilse demo listeye düşer.
// Karar/skorlama mantığı buraya karışmaz (o amazon-radar.ts'te, API'siz test edilebilir).

import type { AmazonCandidate } from "./amazon-radar";
import { SAMPLE_CANDIDATES } from "./amazon-radar-samples";
import {
  discoverAliExpressProducts,
  isAliExpressConfigured,
  type AliDiscoveredProduct,
} from "./aliexpress";

// Radar pazarı → AliExpress ship_to ülke kodu (fiyat/kargo o ülkeye göre gelir).
const MARKET_SHIP_TO: Record<string, string> = { us: "US", uk: "GB", ae: "AE", sa: "SA" };

/**
 * Ham değerlendirmeyi radarın beklediği 0-5 puana çevirir.
 * AliExpress kaynağı bazen 0-5 puan, bazen 0-100 pozitif-değerlendirme yüzdesi döner:
 *   - ≤5  → zaten 0-5 puan, aynen kullan
 *   - >5  → yüzde (0-100) → /20 ile 0-5'e ölçekle (95% → 4.75)
 * Bilinmiyorsa 4.6: veri yokluğu TEK BAŞINA elemesin (eşik 4.5) ama düşük-puanlı
 * (veri VARSA) yakalanabilsin.
 */
export function ratingToStars(raw: number | null): number {
  if (raw == null) return 4.6;
  if (raw <= 5) return Math.max(0, raw);
  return Math.max(0, Math.min(5, raw / 20));
}

/** Keşfedilen AliExpress ürününü radar adayına çevirir. */
export function toCandidate(p: AliDiscoveredProduct): AmazonCandidate {
  return {
    aliId: p.aliId,
    title: p.title,
    aliCost: p.costUsd,
    aliShipping: p.shippingUsd,
    aliOrders: p.orders,
    aliRating: ratingToStars(p.rating),
    // Keşif akışında marka bilgisi gelmez; radar "Generic"i güvenli sayar, ayrıca
    // başlıkta marka geçerse checkBrandSafe zaten eler.
    brand: "Generic",
    category: p.category,
    // Amazon tarafı (BSR / satış tahmini / rekabet) Keepa bağlanana kadar bilinmiyor.
    // Radar bu alanları null'da atlar (talep/rekabet skoru nötr 0.5 olur) — yani şu an
    // AliExpress sinyalleriyle (sipariş, puan, marj) çalışır; Keepa gelince tam açılır.
    amazonBsr: null,
    amazonSalesEst: null,
    amazonSellerCount: null,
    amazonSoldByAmazon: false,
  };
}

/**
 * Bir pazar için radar adaylarını getirir.
 * - AliExpress bağlı + sonuç döndüyse → canlı adaylar (source: "aliexpress")
 * - Bağlı değil / boş / hata → demo liste (source: "demo") — sistem asla kırılmaz
 */
export async function fetchRadarCandidates(
  market: string
): Promise<{ candidates: AmazonCandidate[]; source: "aliexpress" | "demo" }> {
  if (!isAliExpressConfigured()) {
    return { candidates: SAMPLE_CANDIDATES, source: "demo" };
  }
  try {
    const shipTo = MARKET_SHIP_TO[market] ?? "US";
    const raw = await discoverAliExpressProducts({ shipTo, pageSize: 50 });
    if (raw.length === 0) return { candidates: SAMPLE_CANDIDATES, source: "demo" };
    return { candidates: raw.map(toCandidate), source: "aliexpress" };
  } catch (err) {
    console.error("[amazon-radar-source] AliExpress keşif başarısız, demo'ya düşülüyor:", err);
    return { candidates: SAMPLE_CANDIDATES, source: "demo" };
  }
}
