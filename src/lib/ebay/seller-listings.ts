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
    };
    const items = data.itemSummaries ?? [];
    if (items.length === 0) break;

    out.push(...parseBrowseItems(items));

    const total = data.total ?? 0;
    offset += BROWSE_PAGE_SIZE;
    if (offset >= total || offset >= BROWSE_MAX_OFFSET) break;
  }

  return out.slice(0, maxItems);
}
