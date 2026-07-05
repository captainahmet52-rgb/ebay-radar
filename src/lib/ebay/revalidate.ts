// Müşteriye listelemeden ÖNCE yeniden doğrulama — depo kalıcı güvenli DEĞİL.
//
// Bir ASIN depoya girdikten sonra Amazon o ASIN'i farklı bir ürüne geri dönüştürebilir
// (recycled ASIN) ya da baştan zayıf eşleşmiş olabilir. İlk YAYINDAN önce, o an
// canlı çekilen Amazon başlığı, deponun kaydettiği başlıkla hâlâ tutarlı mı kontrol
// edilir. Tutarsızsa yayın ENGELLENİR (kullanıcının gerçek mağazasına yanlış ürün düşmesin).
//
// ÖNEMLİ: poll-product zaten canlı veriyi çekiyor → bu doğrulama EK SCRAPE maliyeti
// getirmez; eldeki taze başlıkla karşılaştırır.

import {
  titleSimilarity,
  extractModelTokens,
  extractPackCount,
} from "@/lib/ebay/asin-matcher";

// İlk yayından önce canlı başlık, depo başlığına en az bu kadar benzemeli.
export const REVALIDATE_SIM_MIN = 0.5;

export interface RevalidateResult {
  ok: boolean;
  reason: string;
}

/**
 * Depo baseline başlığı ile o an canlı çekilen Amazon başlığını karşılaştırır.
 * Başlıklardan biri yoksa doğrulama ATLANIR (sinyal yok → engelleme yok; stok/fiyat
 * kapıları zaten ayrı). Model/paket değişimi ya da düşük benzerlik → yayını ENGELLE.
 */
export function revalidateListingTitle(
  baselineTitle: string | null | undefined,
  liveTitle: string | null | undefined,
): RevalidateResult {
  if (!baselineTitle || !liveTitle) {
    return { ok: true, reason: "başlık eksik — doğrulama atlandı" };
  }

  // Model kodu değişti → ASIN farklı ürüne gitmiş olabilir (recycled ASIN)
  const baseModels = extractModelTokens(baselineTitle);
  const liveModels = extractModelTokens(liveTitle);
  if (
    baseModels.size > 0 &&
    liveModels.size > 0 &&
    ![...baseModels].some((m) => liveModels.has(m))
  ) {
    return { ok: false, reason: "model kodu değişmiş (ASIN farklı ürüne gitmiş olabilir)" };
  }

  // Paket adedi değişti → farklı varyant
  const basePack = extractPackCount(baselineTitle);
  const livePack = extractPackCount(liveTitle);
  if (basePack !== null && livePack !== null && basePack !== livePack) {
    return { ok: false, reason: "paket adedi değişmiş" };
  }

  // Genel başlık tutarlılığı
  const sim = titleSimilarity(baselineTitle, liveTitle);
  if (sim < REVALIDATE_SIM_MIN) {
    return { ok: false, reason: `başlık tutarsız (benzerlik ${sim.toFixed(2)})` };
  }

  return { ok: true, reason: "başlık tutarlı" };
}
