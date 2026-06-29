// Çok-sorgulu Amazon arama üretici — recall artırır.
//
// Tek sorgu (tam başlık) bazen kötü aday getirir (çok uzun/gürültülü). Birden çok
// hedefli sorgu (marka+model, marka+çekirdek isim) daha iyi aday havuzu sağlar.
// MALİYET: worker bu sorguları SIRAYLA dener ve accept bulunca DURUR → kolay item'da
// 1 kredi, sadece zor item'da ek sorgu. Çöp item cache'lenir → re-scan'de tekrar aranmaz.

import { extractModelTokens } from "@/lib/ebay/asin-matcher";

const MAX_QUERY_WORDS = 14;

/**
 * Bir eBay başlığından sıralı Amazon arama sorguları üretir (öncelikli → alternatif):
 *   1) tam başlık (ilk 14 kelime)
 *   2) marka + model kodları (varsa)
 *   3) marka + son 2 kelime (genelde ürün ismi)
 * Tekrarlananlar elenir.
 */
export function buildAmazonQueries(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const queries: string[] = [];
  const push = (q: string) => {
    const t = q.trim();
    if (t.length >= 3 && !queries.includes(t)) queries.push(t);
  };

  // 1) tam başlık (kırpılmış)
  push(words.slice(0, MAX_QUERY_WORDS).join(" "));

  const brand = words[0];

  // 2) marka + model kodları
  const models = [...extractModelTokens(title)];
  if (models.length > 0) {
    push([brand, ...models.slice(0, 2)].join(" "));
  }

  // 3) marka + son 2 kelime (ürün ismi olma ihtimali yüksek)
  if (words.length > 3) {
    push([brand, ...words.slice(-2)].join(" "));
  }

  return queries;
}
