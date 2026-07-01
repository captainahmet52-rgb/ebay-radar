// eBay satıcı/mağaza ilanlarını RESMİ Browse API ile çek — ScrapingBee'siz, BEDAVA.
//
// NEDEN BROWSE API:
//   • Finding API (svcs.ebay.com) 2026'da EMEKLİ → VPS'ten 503/HTML döndürüyor (ÖLÜ).
//   • Mağaza sayfası (/str) ve /sch artık JS-render / IP-bloklu → ham scrape boş.
//   • Browse API (api.ebay.com) OAuth app-token ile çalışır, VPS'ten ERİŞİLEBİLİR,
//     yapılandırılmış JSON, ücretsiz cömert kota. (OAuth zaten üretimde canlı.)
//
// MAĞAZA → SATICI: Browse satıcıyı GERÇEK kullanıcı adıyla tanır (mağaza URL slug'ı
//   DEĞİL). Örn. "usaonemart" mağazası aslında "md.asifpa-0" satıcısıdır. Slug'dan
//   username'e geçiş için mağazadan TEK bir ürün linki yeter (resolveSellerUsername).
//
// TÜM-MAĞAZA DÖKÜMÜ: Browse "q" zorunlu kılar; ama category_ids=0 (kök kategori) +
//   filter=sellers:{username} kombinasyonu satıcının TÜM kataloğunu döker (kanıtlandı:
//   945 ürün). q ile yapılırsa eksik döner; bu yüzden category_ids=0 kullanılır.
//
//   ÖDÜN: Browse item_summary "X sold" (satış adedi) vermez → soldCount null
//   (para motoru kâr × rekabetçilik ile çalışır, talebe bağımlı değil).

import { getApplicationToken } from "@/lib/ebay/oauth";

const BROWSE_BASE = "https://api.ebay.com/buy/browse/v1";
const BROWSE_PAGE_SIZE = 200; // Browse item_summary azami limit
const BROWSE_MAX_OFFSET = 10000; // Browse erişilebilir azami sonuç

export interface EbayApiItem {
  title: string;
  price: number | null;
  itemId: string | null;
  imageUrl: string | null;
  soldCount: number | null; // Browse vermiyor → her zaman null
}

// Browse item_summary kaydının ilgilendiğimiz alanları.
interface BrowseItemSummary {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  price?: { value?: string };
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
}

function browseHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    "Content-Type": "application/json",
  };
}

/** Browse item_summary dizisini sade EbayApiItem listesine çevirir (SAF, test edilebilir). */
export function parseBrowseItems(items: BrowseItemSummary[]): EbayApiItem[] {
  return items.map((it) => {
    const priceStr = it.price?.value;
    const price = priceStr ? parseFloat(priceStr) || null : null;
    const img = it.image?.imageUrl ?? it.thumbnailImages?.[0]?.imageUrl ?? null;
    return {
      title: (it.title ?? "").trim(),
      price,
      itemId: it.itemId ?? it.legacyItemId ?? null,
      imageUrl: img && /^https?:\/\//i.test(img) ? img : null,
      soldCount: null,
    };
  });
}

/** Bir ürün linkinden/metninden eBay legacy item id'sini (9+ rakam) çıkarır (SAF). */
export function extractLegacyItemId(input: string): string | null {
  const trimmed = input.trim();
  const m =
    trimmed.match(/\/itm\/(?:[^/?]*\/)?(\d{9,})/) ?? trimmed.match(/(\d{9,})/);
  return m ? m[1] : null;
}

/**
 * Bir eBay ürün linkindeki/legacy id'deki satıcının GERÇEK kullanıcı adını çözer.
 * Browse getItemByLegacyId → seller.username. Bulamazsa null.
 */
export async function resolveSellerUsername(legacyItemId: string): Promise<string | null> {
  const token = await getApplicationToken();
  const res = await fetch(
    `${BROWSE_BASE}/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyItemId)}`,
    { headers: browseHeaders(token) },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { seller?: { username?: string } };
  return data.seller?.username ?? null;
}

/**
 * Bir satıcının (eBay kullanıcı adı) TÜM ilanlarını Browse API ile çeker (sayfalı).
 * category_ids=0 + filter=sellers:{username} → tüm katalog. maxItems'a ulaşınca durur.
 *
 * NOT: Braces ({}) URL'de LİTERAL kalmalı (eBay filtre söz dizimi); yalnız username
 * encode edilir — kanıtlanmış çalışan biçim budur.
 */
export async function fetchSellerListings(
  username: string,
  maxItems = BROWSE_PAGE_SIZE,
): Promise<EbayApiItem[]> {
  const token = await getApplicationToken();
  const out: EbayApiItem[] = [];
  let offset = 0;

  while (out.length < maxItems) {
    const url =
      `${BROWSE_BASE}/item_summary/search` +
      `?category_ids=0` +
      `&filter=sellers:{${encodeURIComponent(username)}}` +
      `&limit=${BROWSE_PAGE_SIZE}` +
      `&offset=${offset}`;

    const res = await fetch(url, { headers: browseHeaders(token) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`eBay Browse API hatası: ${res.status} — ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      total?: number;
      itemSummaries?: BrowseItemSummary[];
      warnings?: Array<{ message?: string; longMessage?: string }>;
    };

    // GÜVENLİK (1 numaralı kural): geçersiz satıcı adında eBay filtreyi YOK SAYIP
    // rastgele ~23M ürün döndürür. Bunları ASLA radara sokma (yanlış eşleşme = ban).
    // Uyarı "seller ... invalid" içeriyorsa dur — rastgele ürün çekme.
    const warn = (data.warnings ?? [])
      .map((w) => `${w.message ?? ""} ${w.longMessage ?? ""}`)
      .join(" ");
    if (/seller.*invalid|invalid.*seller/i.test(warn)) {
      throw new Error(
        `Geçersiz satıcı adı "${username}" — Browse filtreyi reddetti ` +
        `(rastgele ürün gelmesin diye durduruldu). Mağazadan bir ÜRÜN LİNKİ ile satıcıyı çöz.`,
      );
    }

    const items = data.itemSummaries ?? [];
    if (items.length === 0) break;

    out.push(...parseBrowseItems(items));

    const total = data.total ?? 0;
    offset += BROWSE_PAGE_SIZE;
    if (offset >= total || offset >= BROWSE_MAX_OFFSET) break;
  }

  return out.slice(0, maxItems);
}

// ─── Satış adedi (talep sinyali) ─────────────────────────────────────────────
// Browse getItem, estimatedAvailabilities[].estimatedSoldQuantity döndürür —
// ürün başına TAHMİNİ satış adedi (kanıtlandı: iğne seti 362, kart kılıfı 112).
// Marketplace Insights bu app'e kapalı (404); getItem tek yol. BEDAVA.

interface ItemAvailability {
  estimatedAvailabilities?: Array<{ estimatedSoldQuantity?: number }>;
}

/** getItem yanıtından satış adedini çıkarır (SAF, test edilebilir). */
export function parseSoldQuantity(item: ItemAvailability): number | null {
  return item.estimatedAvailabilities?.[0]?.estimatedSoldQuantity ?? null;
}

/** Tek bir ürünün tahmini satış adedini çeker (Browse getItem). Hata → null. */
export async function getItemSoldCount(itemId: string): Promise<number | null> {
  const token = await getApplicationToken();
  const res = await fetch(`${BROWSE_BASE}/item/${encodeURIComponent(itemId)}`, {
    headers: browseHeaders(token),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ItemAvailability;
  return parseSoldQuantity(data);
}

/**
 * Ürün listesini satış adediyle zenginleştirir (sınırlı eşzamanlılıkla — Browse
 * rate limit dostu). Her öğe için getItem → soldCount. Yeni dizi döndürür (immutable).
 * onProgress: her ~15 üründe bir ilerleme (UI bar'ı için).
 */
export async function enrichSoldCounts(
  items: EbayApiItem[],
  concurrency = 6,
  onProgress?: (done: number) => void,
): Promise<EbayApiItem[]> {
  const out = [...items];
  let idx = 0;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= out.length) break;
      const it = out[i];
      if (it.itemId) {
        try {
          out[i] = { ...it, soldCount: await getItemSoldCount(it.itemId) };
        } catch {
          /* satış verisi alınamadı → soldCount null kalır */
        }
      }
      done++;
      if (onProgress && done % 15 === 0) onProgress(done);
    }
  }

  const workers = Math.max(1, Math.min(concurrency, out.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  onProgress?.(out.length);
  return out;
}
