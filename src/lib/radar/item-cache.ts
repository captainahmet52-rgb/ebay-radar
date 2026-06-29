// eBay itemId değerlendirme cache'i — KREDİ TASARRUFU.
//
// Aynı mağaza tekrar tarandığında, daha önce değerlendirilmiş eBay item'larını
// (özellikle SKIP olanları) tekrar Amazon'da ARAMAYIZ → ScrapingBee kredisi yanmaz.
// TTL'li (varsayılan 3 gün) → fiyat/stok değişimi için periyodik yeniden değerlendirme olur.
// accept/review zaten depoya girer (ASIN unique dedup ayrı korur); cache ASIL skip içindir.

const SEEN_TTL_SECONDS = 3 * 24 * 60 * 60; // 3 gün
const KEY = (itemId: string) => `radar:seen:${itemId}`;

// ioredis'in get/set alt kümesi (testte sahte enjekte edilir).
export interface CacheRedis {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttl: number): Promise<unknown>;
}

/** itemId yakın zamanda değerlendirildi mi? (cache'te varsa Amazon araması atlanır) */
export async function wasRecentlySeen(redis: CacheRedis, itemId: string): Promise<boolean> {
  try {
    return (await redis.get(KEY(itemId))) !== null;
  } catch {
    return false; // cache hatası → güvenli taraf: değerlendir (atlamadan ara)
  }
}

/** itemId'i değerlendirildi olarak işaretle (kararıyla, TTL'li). */
export async function markSeen(
  redis: CacheRedis,
  itemId: string,
  decision: string,
): Promise<void> {
  try {
    await redis.set(KEY(itemId), decision, "EX", SEEN_TTL_SECONDS);
  } catch {
    /* cache yazımı kritik değil */
  }
}
