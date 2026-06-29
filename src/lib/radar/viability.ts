// Radar "para motoru" — bir ASIN otomatik listelemeye DEĞER mi?
//
// Repricer eBay fiyatını zaten %20 net kâr verecek şekilde HESAPLIYOR → kâr garanti.
// O yüzden asıl soru "kârlı mı?" değil:
//   1) Bizim hesapladığımız fiyat, rakibin sattığı fiyata göre REKABETÇİ mi? (yoksa satmaz)
//   2) Bu ürün gerçekten SATIYOR mu? (rakip mağazanın "X sold" sinyali = kanıtlı talep)
// Bu iki sinyalle hem GROSSLY uncompetitive ürünleri eler hem depoyu kâr×talep ile sıralar.

import { calculateEbayPrice } from "@/lib/repricer";

export interface ViabilityInput {
  amazonPrice: number | null;
  competitorPrice: number | null; // rakibin eBay satış fiyatı (item.price)
  soldCount: number | null; // rakibin sattığı adet (talep)
  ebayFeeRate?: number;
  targetMargin?: number;
}

export interface Viability {
  projectedEbayPrice: number | null;
  projectedProfit: number | null;
  projectedMarginPct: number | null;
  competitiveness: number | null; // rakipFiyat / bizimFiyat (>=1 → biz daha ucuz, iyi)
  rankScore: number; // yüksek = daha iyi (talep × rekabetçilik × kâr)
  viable: boolean; // false → rakipten aşırı pahalı (satmaz), depoya alma
  reason: string;
}

// Bizim fiyatımız rakibin fiyatının bu kat üstündeyse → satmaz, ele.
// (competitiveness = rakip/bizim < 0.67  ⇔  bizimFiyat > rakip × 1.5)
export const MIN_COMPETITIVENESS = 0.67;

function clampScore(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function assessViability(input: ViabilityInput): Viability {
  const sold = input.soldCount != null && input.soldCount > 0 ? input.soldCount : 0;
  const demandFactor = Math.log1p(sold); // 0 (bilinmiyor/satmamış) → dampened

  // Amazon fiyatı yoksa fiyatlandıramayız → kâr/rekabet bilinmez, talep ile sırala.
  if (input.amazonPrice == null || input.amazonPrice <= 0) {
    return {
      projectedEbayPrice: null,
      projectedProfit: null,
      projectedMarginPct: null,
      competitiveness: null,
      rankScore: demandFactor, // sadece talep
      viable: true,
      reason: "Amazon fiyatı yok — talep ile sıralandı",
    };
  }

  let projected;
  try {
    projected = calculateEbayPrice(
      input.amazonPrice,
      input.ebayFeeRate ?? 0.136,
      input.targetMargin ?? 0.2,
    );
  } catch {
    return {
      projectedEbayPrice: null,
      projectedProfit: null,
      projectedMarginPct: null,
      competitiveness: null,
      rankScore: demandFactor,
      viable: true,
      reason: "fiyat hesaplanamadı — talep ile sıralandı",
    };
  }

  const projectedEbayPrice = projected.ebayPrice;
  const projectedProfit = projected.netProfit;
  const projectedMarginPct = projected.marginPct;

  // Rekabetçilik: rakibin fiyatı / bizim hesapladığımız fiyat
  const competitiveness =
    input.competitorPrice != null && input.competitorPrice > 0 && projectedEbayPrice > 0
      ? input.competitorPrice / projectedEbayPrice
      : null;

  // Aşırı pahalıysak (rakibin 1.5 katından fazla) → satmaz, ele
  if (competitiveness !== null && competitiveness < MIN_COMPETITIVENESS) {
    return {
      projectedEbayPrice,
      projectedProfit,
      projectedMarginPct,
      competitiveness,
      rankScore: 0,
      viable: false,
      reason: `rakipten aşırı pahalı (bizim $${projectedEbayPrice.toFixed(0)} vs rakip $${input.competitorPrice!.toFixed(0)})`,
    };
  }

  // Rank skoru: (talep + taban) × rekabetçilik × kâr
  // +0.5 taban → hiç satmamış ama kârlı+rekabetçi ürün de sıralanır.
  const compFactor = competitiveness === null ? 1 : Math.min(competitiveness, 2);
  const rankScore = clampScore((demandFactor + 0.5) * compFactor * Math.max(0, projectedProfit));

  return {
    projectedEbayPrice,
    projectedProfit,
    projectedMarginPct,
    competitiveness,
    rankScore,
    viable: true,
    reason:
      sold > 0
        ? `${sold} satış + rekabetçi (skor ${rankScore.toFixed(1)})`
        : `kârlı + rekabetçi (skor ${rankScore.toFixed(1)})`,
  };
}
