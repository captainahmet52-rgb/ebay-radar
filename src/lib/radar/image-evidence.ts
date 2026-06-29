// Görsel kanıt katmanı — metin kararını görselle GÜÇLENDİR ya da ÇÜRÜT.
//
// selectRadarMatch saf/senkron kalır (ağ yok). Bu katman ASENKRON çalışır ve yalnız
// en iyi birkaç hayatta-kalan aday için görsel karşılaştırır:
//   • review/skip → accept'e YÜKSELT (Sözleşme C: güçlü pHash + metin teyidi)
//   • accept'i SAVUN: kabul edilen adayın görseli çelişiyorsa → review'a indir
// Her zaman EN FAZLA tek ASIN. Karşılaştırıcı enjekte edilir (testte sahte).

import {
  MIN_CORE_TOKENS,
  type RadarSourceItem,
  type RadarMatchResult,
} from "@/lib/radar/source-matcher";
import {
  imageVerdict,
  type UrlImageComparator,
  type ImageSim,
  type ImageVerdict,
} from "@/lib/radar/image-compare";

export interface ImageEvidenceOptions {
  /** Görseli karşılaştırılacak en iyi aday sayısı (varsayılan 4). */
  maxCandidates?: number;
}

interface ComparedSurvivor {
  asin: string;
  candidate: RadarMatchResult["ranked"][number]["candidate"];
  sim: ImageSim;
  verdict: ImageVerdict;
  typeAgree: boolean;
  priceAbsoluteOk: boolean;
  sharedTokens: number;
  textSim: number;
}

/**
 * Metin tabanlı sonucu görsel kanıtla rafine eder.
 * Kaynak görsel yoksa ya da görsel karşılaştırılamıyorsa base AYNEN döner (güvenli).
 */
export async function refineWithImageEvidence(
  item: RadarSourceItem,
  base: RadarMatchResult,
  compare: UrlImageComparator,
  opts: ImageEvidenceOptions = {},
): Promise<RadarMatchResult> {
  const maxCandidates = opts.maxCandidates ?? 4;
  const srcImg = item.imageUrl;
  if (!srcImg || base.ranked.length === 0) return base;

  const pool = base.ranked.filter((r) => r.candidate.imageUrl).slice(0, maxCandidates);
  if (pool.length === 0) return base;

  const compared: ComparedSurvivor[] = [];
  for (const r of pool) {
    const sim = await compare(srcImg, r.candidate.imageUrl as string);
    if (!sim) continue;
    compared.push({
      asin: r.candidate.asin,
      candidate: r.candidate,
      sim,
      verdict: imageVerdict(sim),
      typeAgree: r.evaluation.typeAgree,
      priceAbsoluteOk: r.evaluation.priceAbsoluteOk,
      sharedTokens: r.evaluation.sharedTokens,
      textSim: r.evaluation.sim,
    });
  }
  if (compared.length === 0) return base; // hiçbiri karşılaştırılamadı → metin kararı

  // Sözleşme C uygunluğu: güçlü görsel ("same") + tip uyumu + fiyat bandı + metin teyidi
  const strongEligible = compared.filter(
    (c) =>
      c.verdict === "same" &&
      c.typeAgree &&
      c.priceAbsoluteOk &&
      c.sharedTokens >= MIN_CORE_TOKENS,
  );

  // ── base ZATEN accept ise: teyit / çelişki / savunma ──
  if (base.decision === "accept" && base.candidate) {
    const acceptedAsin = base.candidate.asin;
    const acceptedEligible = strongEligible.some((c) => c.asin === acceptedAsin);
    const otherEligible = strongEligible.filter((c) => c.asin !== acceptedAsin);
    const acceptedCmp = compared.find((c) => c.asin === acceptedAsin);

    if (acceptedEligible && otherEligible.length === 0) {
      return { ...base, contract: `${base.contract}+img`, reason: "metin + görsel teyitli" };
    }
    if (otherEligible.length > 0) {
      // Metin X dedi ama görsel başka adayı işaret ediyor → sessizce DEĞİŞTİRME, incele
      return {
        ...base,
        decision: "review",
        contract: null,
        reason: "görsel farklı adayı işaret ediyor — elle doğrula",
      };
    }
    if (acceptedCmp && acceptedCmp.verdict === "different") {
      return {
        ...base,
        decision: "review",
        contract: null,
        reason: "görsel metinle çelişiyor (farklı foto) — elle doğrula",
      };
    }
    return base; // görsel nötr → metin accept'i korunur
  }

  // ── base accept DEĞİL (review/skip): görselle yükseltme ──
  if (strongEligible.length === 1) {
    const win = strongEligible[0];
    return {
      ...base,
      decision: "accept",
      asin: win.asin,
      candidate: win.candidate,
      contract: "C",
      confidence: Math.max(base.confidence, win.textSim),
      reason: "görsel eşleşmesi (pHash) + metin teyidi",
    };
  }
  if (strongEligible.length > 1) {
    const top = strongEligible[0];
    return {
      ...base,
      decision: "review",
      asin: top.asin,
      candidate: top.candidate,
      contract: null,
      reason: "birden çok görsel-eşleşen varyant — elle doğrula",
    };
  }

  return base;
}
