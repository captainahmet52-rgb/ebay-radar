// Görsel karşılaştırma kademesi (deterministik): URL kimliği → pHash + dHash.
//
// CLIP/embedding KULLANMAZ — onlar semantik (kategori) benzerliği ölçer, SKU kimliği
// değil → yanlış pozitif artırır. Burada amaç "AYNI görsel mi?" (yeniden kullanılmış
// ürün fotoğrafı), kategori benzerliği değil.

import { pHash, dHash, hamming, type Grayscale } from "@/lib/radar/image-hash";

export interface ImageSim {
  phash: number; // 0..64 Hamming
  dhash: number; // 0..64 Hamming
}

// Eşikler — kademeli. pHash birincil, dHash teyit.
export const IMG_STRONG_PHASH = 6; // ≤ → güçlü "aynı görsel"
export const IMG_WEAK_PHASH = 12; // ≤ → zayıf benzer (teyitle birlikte)
export const IMG_DHASH_CORROB = 14; // dHash bu sınırın altındaysa pHash'i destekler

export type ImageVerdict = "same" | "similar" | "different";

export function imageVerdict(sim: ImageSim): ImageVerdict {
  if (sim.phash <= IMG_STRONG_PHASH && sim.dhash <= IMG_DHASH_CORROB) return "same";
  if (sim.phash <= IMG_WEAK_PHASH) return "similar";
  return "different";
}

/** İki gri-tonlama görüntüsünün pHash + dHash mesafesi. */
export function compareGray(a: Grayscale, b: Grayscale): ImageSim {
  return {
    phash: hamming(pHash(a), pHash(b)),
    dhash: hamming(dHash(a), dHash(b)),
  };
}

/** URL → gri-tonlama yükleyici tipi (gerçekte image-fetch; testte sahte enjekte edilir). */
export type GrayscaleLoader = (url: string) => Promise<Grayscale | null>;

/** İki URL'i karşılaştıran fonksiyon — null = karşılaştırılamadı (decode/ağ hatası). */
export type UrlImageComparator = (urlA: string, urlB: string) => Promise<ImageSim | null>;

/**
 * Yükleyiciden bir URL karşılaştırıcı kurar. Aynı URL → mesafe 0 (kısa devre).
 * Görsellerden biri yüklenemezse null (görsel kanıt yok).
 */
export function makeUrlComparator(load: GrayscaleLoader): UrlImageComparator {
  return async (urlA, urlB) => {
    if (!urlA || !urlB) return null;
    if (urlA === urlB) return { phash: 0, dhash: 0 };
    const [a, b] = await Promise.all([load(urlA), load(urlB)]);
    if (!a || !b) return null;
    return compareGray(a, b);
  };
}
