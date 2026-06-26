// eBay ilanı → Amazon ASIN eşleştirme — "SIFIR HATA" kalbi.
//
// Temel kural: sistem ASLA tahmin etmez, yalnız TEYİT eder.
// Bir ilan otomatik takibe ancak şu üçü birden sağlanırsa alınır:
//   1) Satıcının SKU'sunda gerçek bir ASIN var (kendi beyan ettiği bağ),
//   2) O ASIN Amazon'dan çekilip BAŞLIĞI eBay ilanıyla yeterince eşleşiyor,
//   3) Amazon fiyatı, eBay fiyatına göre akıl dışı sapma göstermiyor.
// Bunların biri bile sağlanmazsa: "review" (doğrula) ya da "unmatched" — DOKUNMA.

/** SKU içindeki ilk ASIN'i ayıklar (Amazon ASIN: B0 + 8 alfanümerik). Yoksa null. */
export function extractAsinFromSku(sku: string | null | undefined): string | null {
  if (!sku) return null;
  const m = sku.toUpperCase().match(/B0[A-Z0-9]{8}/);
  return m ? m[0] : null;
}

// Başlık normalizasyonu — küçük harf, noktalama temizliği, kısa/durak kelimeleri at.
const STOP_WORDS = new Set([
  "the", "and", "for", "with", "new", "pcs", "pack", "set", "size",
  "color", "from", "你", "x", "pc",
]);

export function normalizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * İki başlığın benzerliği (0..1). Küçük kümeyi referans alır:
 * "biri diğerini ne kadar kapsıyor" — eBay başlığı genelde Amazon'unkinin
 * kısaltılmışı/zenginleştirilmişi olduğu için bu ölçü dropshipping'de sağlam.
 */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(normalizeTitle(a));
  const B = new Set(normalizeTitle(b));
  if (A.size === 0 || B.size === 0) return 0;
  let intersection = 0;
  for (const w of A) if (B.has(w)) intersection++;
  return intersection / Math.min(A.size, B.size);
}

/**
 * Model-kodu token'ları: harf VE rakam içeren, >=4 uzunlukta diziler.
 * Örn: "WH-1000XM4" → "WH1000XM4", "A2342". Saf sayı ("13") veya saf harf
 * ("iPhone") ELENMEZ → uyumluluk listelerinden ("for iPhone 13 14") yanlış veto gelmez.
 */
export function extractModelTokens(title: string): Set<string> {
  const out = new Set<string>();
  const matches = title.toUpperCase().match(/[A-Z0-9][A-Z0-9-]{2,}/g) ?? [];
  for (const m of matches) {
    const compact = m.replace(/-/g, "");
    if (compact.length >= 4 && /[A-Z]/.test(compact) && /[0-9]/.test(compact)) {
      out.add(compact);
    }
  }
  return out;
}

/** Başlıktan paket adedini çıkarır: "2 pack", "set of 3", "4 pcs". Yoksa null. */
export function extractPackCount(title: string): number | null {
  const t = title.toLowerCase();
  const m =
    t.match(/(\d{1,3})\s*[-\s]?\s*(?:pack|packs|pcs|pieces|count|ct|pairs?|sets?)\b/) ||
    t.match(/(?:pack|set)\s+of\s+(\d{1,3})/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n < 1000) return n;
  }
  return null;
}

export interface MatchInput {
  sku: string | null;
  ebayTitle: string;
  ebayPrice: number | null;
}

export interface AmazonCandidate {
  asin: string;
  title: string;
  price: number | null;
}

export type MatchStatus = "confirmed" | "review" | "unmatched";

export interface MatchResult {
  status: MatchStatus;
  asin: string | null;
  confidence: number; // 0..1 (başlık benzerliği)
  reason: string;
}

// Eşikler — değişmesi gerekirse tek yerden.
export const TITLE_CONFIRM_THRESHOLD = 0.6; // bu ve üstü → teyit
export const PRICE_SANITY_MULTIPLIER = 5; // Amazon > eBay*5 ise şüpheli → doğrula
// En az bu kadar ANLAMLI ortak kelime olmadan teyit YOK. Tek kelimelik/aşırı genel
// başlıkta (örn. sadece "Headphones") sim 1.0 çıkabilir; bu zayıf kanıttır → review.
export const MIN_SHARED_TOKENS = 2;

/**
 * Bir eBay ilanı için karar verir. `amazon`, SKU'dan çıkan ASIN ile
 * fetchAmazonProduct'tan gelen üründür (yoksa null).
 * SADECE "confirmed" sonuçlar otomatik takibe alınmalı; "review"/"unmatched"
 * fiyat/stoğa ASLA dokunmaz.
 */
export function decideMatch(input: MatchInput, amazon: AmazonCandidate | null): MatchResult {
  const asin = extractAsinFromSku(input.sku);

  // 1) SKU'da ASIN yok → tahmin etmeyiz.
  if (!asin) {
    return { status: "unmatched", asin: null, confidence: 0, reason: "SKU'da ASIN bulunamadı" };
  }

  // 2) ASIN var ama Amazon ürünü çekilemedi → doğrulanamadı, dokunma.
  if (!amazon) {
    return { status: "review", asin, confidence: 0, reason: "Amazon ürünü doğrulanamadı" };
  }

  // 3) Başlık doğrulaması — sim VE ortak anlamlı kelime sayısı birlikte.
  const aTokens = new Set(normalizeTitle(input.ebayTitle));
  const bTokens = new Set(normalizeTitle(amazon.title));
  let shared = 0;
  for (const w of aTokens) if (bTokens.has(w)) shared++;
  const minSize = Math.min(aTokens.size, bTokens.size);
  const sim = minSize === 0 ? 0 : shared / minSize;

  // 4) Fiyat akıl kontrolü (yanlış ASIN'i yakalar).
  const priceInsane =
    input.ebayPrice !== null &&
    input.ebayPrice > 0 &&
    amazon.price !== null &&
    amazon.price > input.ebayPrice * PRICE_SANITY_MULTIPLIER;

  // 5) ÇELİŞKİ KAPILARI (SIFIR HATA) — yalnız GERÇEK çatışmada veto eder.
  //    Geri dönüştürülmüş/bayat ASIN artık farklı ürüne gidiyorsa burada yakalanır.
  const ebayModels = extractModelTokens(input.ebayTitle);
  const amazonModels = extractModelTokens(amazon.title);
  // İki tarafta da model kodu var ama HİÇ ortak yok → farklı ürün (örn. XM3 vs XM4)
  const modelConflict =
    ebayModels.size > 0 &&
    amazonModels.size > 0 &&
    ![...ebayModels].some((m) => amazonModels.has(m));

  // İki tarafta da paket adedi belirtilmiş ama farklı → farklı ürün (1'li vs 4'lü)
  const ebayPack = extractPackCount(input.ebayTitle);
  const amazonPack = extractPackCount(amazon.title);
  const packConflict = ebayPack !== null && amazonPack !== null && ebayPack !== amazonPack;

  if (modelConflict) {
    return { status: "review", asin, confidence: sim, reason: "Model kodu çelişiyor — elle doğrula" };
  }
  if (packConflict) {
    return { status: "review", asin, confidence: sim, reason: "Paket adedi çelişiyor — elle doğrula" };
  }

  if (sim >= TITLE_CONFIRM_THRESHOLD && shared >= MIN_SHARED_TOKENS && !priceInsane) {
    return { status: "confirmed", asin, confidence: sim, reason: "Başlık + fiyat teyitli, çelişki yok" };
  }

  const thinTitle = shared < MIN_SHARED_TOKENS;
  return {
    status: "review",
    asin,
    confidence: sim,
    reason: priceInsane
      ? "Amazon fiyatı eBay fiyatından aşırı sapıyor — elle doğrula"
      : thinTitle
        ? "Başlık çok kısa/genel — yeterli kanıt yok, elle doğrula"
        : "Başlık yeterince eşleşmedi — elle doğrula",
  };
}
