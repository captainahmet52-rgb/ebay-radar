// Radar kaynak eşleştirici — "KANITLA ya da ATLA" (abstaining classifier).
//
// Soru "en olası ASIN hangisi?" DEĞİL → "herhangi biri otomatik listelenecek
// kadar GÜVENLİ mi?". Çoğu ürün SKIP olur, bu doğrudur. Tek bir yanlış ASIN
// müşterinin gerçek mağazasına listelenir → yanlış kargo → ban. Bu yüzden
// kanıt yoksa ASLA kabul etmeyiz; en fazla TEK ASIN döneriz, yoksa hiç.
//
// asin-matcher.ts'teki kanıtlanmış primitive'leri (normalizeTitle, model/pack
// çıkarımı) yeniden kullanır; onun decideMatch sözleşmesini DEĞİŞTİRMEZ.

import {
  normalizeTitle,
  extractModelTokens,
  extractPackCount,
} from "@/lib/ebay/asin-matcher";
import { compareProductType } from "@/lib/radar/product-type";
import { attributeConflict } from "@/lib/radar/attributes";

// ─── Eşikler (tek yerden) ────────────────────────────────────────────────────
// Fiyat oranı = amazon / ebay. Bayi eBay'de Amazon maliyetinin ~1.5-2 katına satar
// → beklenen oran ~0.5-0.65. Mutlak veto bandı geniş, hassas bant dar.
export const PRICE_ABS_MIN = 0.25;
export const PRICE_ABS_MAX = 0.95;
export const PRICE_PRECISION_MIN = 0.45;
export const PRICE_PRECISION_MAX = 0.82;
// Kabul için en az bu kadar ANLAMLI ortak kelime (ya da ortak model kodu) şart.
export const MIN_CORE_TOKENS = 3;
export const SIM_REVIEW = 0.5; // bu ve üstü + yeterli kanıt → en az "review"
export const SIM_ACCEPT = 0.62; // Sözleşme D taban benzerliği
export const STRONG_SIM = 0.7; // Sözleşme D güçlü benzerlik
export const WINNER_GAP = 0.12; // en iyi, ikinciyi bu kadar geçmeli (belirsizlik freni)
export const THIN_TITLE_MIN = 3; // kaynak başlıkta en az bu kadar anlamlı kelime

export interface RadarSourceItem {
  title: string;
  price: number | null; // eBay (bayi) satış fiyatı
  imageUrl?: string | null; // eBay ilan görseli (Faz 2 görsel kanıtı için)
}

export interface RadarCandidate {
  asin: string;
  title: string;
  price: number | null; // Amazon fiyatı
  imageUrl?: string | null;
}

export type RadarDecision = "accept" | "review" | "skip";

export interface RadarCandidateEval {
  asin: string;
  vetoed: boolean;
  vetoReason: string | null;
  score: number;
  sim: number;
  jaccard: number;
  sharedTokens: number;
  sharedModel: boolean;
  priceRatio: number | null;
  priceAbsoluteOk: boolean;
  pricePrecision: boolean;
  typeAgree: boolean;
}

export interface RankedSurvivor {
  candidate: RadarCandidate;
  evaluation: RadarCandidateEval;
}

export interface RadarMatchResult {
  decision: RadarDecision;
  asin: string | null;
  candidate: RadarCandidate | null;
  contract: string | null; // hangi kanıt sözleşmesi geçti (accept'te)
  confidence: number; // 0..1
  reason: string;
  evals: RadarCandidateEval[]; // denetim/kalibrasyon için tüm aday değerlendirmeleri
  // Vetoyu geçen adaylar, skora göre sıralı (Faz 2 görsel kanıt katmanı kullanır)
  ranked: RankedSurvivor[];
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

function sharedCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
}

function sim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  return sharedCount(a, b) / Math.min(a.size, b.size);
}

function priceRatio(item: RadarSourceItem, cand: RadarCandidate): number | null {
  if (item.price === null || item.price <= 0 || cand.price === null || cand.price <= 0) {
    return null;
  }
  return cand.price / item.price;
}

// ─── Tek adayı değerlendir (vetolar + skorlar) ───────────────────────────────

function evaluateCandidate(
  item: RadarSourceItem,
  cand: RadarCandidate,
  srcTokens: Set<string>,
  srcModels: Set<string>,
): RadarCandidateEval {
  const base: Omit<RadarCandidateEval, "vetoed" | "vetoReason"> = {
    asin: cand.asin,
    score: 0,
    sim: 0,
    jaccard: 0,
    sharedTokens: 0,
    sharedModel: false,
    priceRatio: priceRatio(item, cand),
    priceAbsoluteOk: false,
    pricePrecision: false,
    typeAgree: false,
  };
  const veto = (reason: string): RadarCandidateEval => ({ ...base, vetoed: true, vetoReason: reason });

  // 1) Fiyat mutlak bandı (bilinen fiyatlarda)
  const ratio = base.priceRatio;
  if (ratio !== null) {
    if (ratio < PRICE_ABS_MIN || ratio > PRICE_ABS_MAX) {
      return veto(`fiyat bandı dışı (oran ${ratio.toFixed(2)})`);
    }
    base.priceAbsoluteOk = true;
    base.pricePrecision = ratio >= PRICE_PRECISION_MIN && ratio <= PRICE_PRECISION_MAX;
  }

  // 2) Ürün tipi çelişkisi (uyumluluk bağlamı atılmış core üzerinden)
  const typeCmp = compareProductType(item.title, cand.title);
  if (typeCmp === "conflict") return veto("ürün tipi çelişiyor");
  base.typeAgree = typeCmp === "agree";

  // 3) Nitelik (negatif token) çelişkisi: voltaj/uzunluk/güç/hacim
  const attrConflict = attributeConflict(item.title, cand.title);
  if (attrConflict) return veto(`${attrConflict} çelişiyor`);

  // 4) Model kodu çelişkisi (iki tarafta da var, ortak yok)
  const candModels = extractModelTokens(cand.title);
  const modelConflict =
    srcModels.size > 0 && candModels.size > 0 && ![...srcModels].some((m) => candModels.has(m));
  if (modelConflict) return veto("model kodu çelişiyor");
  base.sharedModel = srcModels.size > 0 && [...srcModels].some((m) => candModels.has(m));

  // 5) Paket adedi çelişkisi
  const srcPack = extractPackCount(item.title);
  const candPack = extractPackCount(cand.title);
  if (srcPack !== null && candPack !== null && srcPack !== candPack) {
    return veto("paket adedi çelişiyor");
  }

  // ── Skorlar (yalnız vetoyu geçenler) ──
  // Tip tespiti core üzerinden yapıldı; benzerlik TAM başlık üzerinden (zengin kanıt).
  const candTokens = new Set(normalizeTitle(cand.title));
  base.sim = sim(srcTokens, candTokens);
  base.jaccard = jaccard(srcTokens, candTokens);
  base.sharedTokens = sharedCount(srcTokens, candTokens);
  base.score =
    base.sim * 0.55 +
    base.jaccard * 0.25 +
    (base.sharedModel ? 0.1 : 0) +
    (base.pricePrecision ? 0.1 : 0);

  return { ...base, vetoed: false, vetoReason: null };
}

// ─── Ana giriş: tek kazanan ya da hiç ────────────────────────────────────────

/**
 * Bir eBay kaynak ürünü + Amazon aday listesi → en fazla TEK güvenli ASIN.
 * `accept`  → depoya eklenebilir (kanıt sözleşmesi geçti)
 * `review`  → insan incelemesi (orta kanıt) — otomatik listelenMEZ
 * `skip`    → kanıt yok, atla
 */
export function selectRadarMatch(
  item: RadarSourceItem,
  candidates: RadarCandidate[],
): RadarMatchResult {
  const none = (
    decision: RadarDecision,
    reason: string,
    evals: RadarCandidateEval[] = [],
    ranked: RankedSurvivor[] = [],
  ): RadarMatchResult => ({
    decision,
    asin: null,
    candidate: null,
    contract: null,
    confidence: 0,
    reason,
    evals,
    ranked,
  });

  // 0) Kaynak başlık zayıf mı? (ayırt edici güç yok → güvenli kanıt kurulamaz)
  const srcTokens = new Set(normalizeTitle(item.title));
  const srcModels = extractModelTokens(item.title);
  if (srcTokens.size < THIN_TITLE_MIN && srcModels.size === 0) {
    return none("skip", "kaynak başlık çok zayıf — güvenli kanıt yok");
  }

  if (candidates.length === 0) return none("skip", "aday yok");

  // 1) Her adayı değerlendir
  const evals = candidates.map((c) => evaluateCandidate(item, c, srcTokens, srcModels));
  const survivorsIdx = evals
    .map((e, i) => ({ e, i }))
    .filter((x) => !x.e.vetoed)
    .sort((a, b) => b.e.score - a.e.score);

  const ranked: RankedSurvivor[] = survivorsIdx.map((x) => ({
    candidate: candidates[x.i],
    evaluation: x.e,
  }));

  if (survivorsIdx.length === 0) {
    return none("skip", "tüm adaylar elendi (veto)", evals);
  }

  const best = survivorsIdx[0].e;
  const bestCand = candidates[survivorsIdx[0].i];
  const second = survivorsIdx[1]?.e ?? null;
  const gap = best.score - (second?.score ?? 0);

  // 2) Minimum kanıt: yeterli ortak kelime YA DA ortak model şart
  const hasMinEvidence = best.sharedTokens >= MIN_CORE_TOKENS || best.sharedModel;
  if (!hasMinEvidence) {
    return none("skip", "yeterli ortak kanıt yok (kelime/model)", evals, ranked);
  }

  // 3) Belirsizlik freni: ikinci aday çok yakınsa (farklı ASIN), kabul etme.
  const ambiguous = second !== null && gap < WINNER_GAP;

  // Fiyat kapısı: fiyat biliniyorsa hassas bant şart; bilinmiyorsa daha güçlü
  // başlık kanıtı (≥4 ortak kelime) ile telafi.
  const priceKnown = best.priceRatio !== null;
  const priceGateOk = priceKnown ? best.pricePrecision : best.sharedTokens >= 4;

  const accept = (contract: string): RadarMatchResult => ({
    decision: "accept",
    asin: bestCand.asin,
    candidate: bestCand,
    contract,
    confidence: best.sim,
    reason: `kanıt sözleşmesi ${contract} geçti`,
    evals,
    ranked,
  });

  // ── Kanıt Sözleşmesi B: marka+model ──
  // Ortak model kodu + tip uyumu + fiyat kapısı + belirsiz değil → güçlü kabul.
  if (best.sharedModel && best.typeAgree && priceGateOk && !ambiguous) {
    return accept("B");
  }

  // ── Kanıt Sözleşmesi D: güçlü başlık ──
  // Yüksek benzerlik + ≥4 ortak kelime + tip uyumu + fiyat kapısı + net üstünlük.
  if (
    best.sim >= STRONG_SIM &&
    best.sharedTokens >= 4 &&
    best.typeAgree &&
    priceGateOk &&
    !ambiguous
  ) {
    return accept("D");
  }

  // ── Review bandı: orta kanıt → insan incelemesi (otomatik listelenmez) ──
  if (best.sim >= SIM_REVIEW && best.sharedTokens >= MIN_CORE_TOKENS && best.priceAbsoluteOk) {
    return {
      decision: "review",
      asin: bestCand.asin,
      candidate: bestCand,
      contract: null,
      confidence: best.sim,
      reason: ambiguous ? "birden çok yakın aday — elle doğrula" : "orta kanıt — elle doğrula",
      evals,
      ranked,
    };
  }

  return none("skip", "kanıt sözleşmesi geçilemedi", evals, ranked);
}
