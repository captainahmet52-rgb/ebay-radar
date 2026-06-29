// eBay satıcı/mağaza ilanlarını RESMİ API ile çek — ScrapingBee'siz, BEDAVA.
//
// findItemsIneBayStores (Finding API): bir eBay mağazasının tüm ilanlarını storeName
// ile listeler, anahtar kelime GEREKTİRMEZ. Auth = App ID (EBAY_CLIENT_ID, gizli secret
// gerekmez). Radar'ın eBay tarafını scrape yerine buna bağlarız:
//   • Bedava (eBay API ücretsiz, cömert kota) — ScrapingBee kredisi yanmaz
//   • Güvenilir — 403 yok, selector kırılması yok, yapılandırılmış JSON
//   • ÖDÜN: "X sold" (satış adedi) API'de yok → soldCount null (para motoru kâr×rekabetçilikle çalışır)

const FINDING_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

export interface EbayApiItem {
  title: string;
  price: number | null;
  itemId: string | null;
  imageUrl: string | null;
  soldCount: number | null; // Finding API vermiyor → her zaman null
}

// Finding API'nin (JSON) item kaydı — alanlar dizi içinde gelir.
interface RawFindingItem {
  itemId?: string[];
  title?: string[];
  galleryURL?: string[];
  sellingStatus?: Array<{ currentPrice?: Array<{ __value__?: string }> }>;
}

/** Finding API item dizisini sade EbayApiItem listesine çevirir (SAF, test edilebilir). */
export function parseFindingItems(items: RawFindingItem[]): EbayApiItem[] {
  return items.map((it) => {
    const priceStr = it.sellingStatus?.[0]?.currentPrice?.[0]?.__value__;
    const price = priceStr ? parseFloat(priceStr) || null : null;
    const img = it.galleryURL?.[0] ?? null;
    return {
      title: (it.title?.[0] ?? "").trim(),
      price,
      itemId: it.itemId?.[0] ?? null,
      imageUrl: img && /^https?:\/\//i.test(img) ? img : null,
      soldCount: null,
    };
  });
}

interface FindingResponse {
  findItemsIneBayStoresResponse?: Array<{
    ack?: string[];
    errorMessage?: unknown;
    searchResult?: Array<{ item?: RawFindingItem[] }>;
    paginationOutput?: Array<{ totalPages?: string[] }>;
  }>;
}

/**
 * Bir eBay mağazasının ilanlarını çeker (sayfalı). storeName = mağazanın GÖRÜNEN adı
 * (örn. "USA One Mart"). maxItems'a ulaşınca ya da sayfa bitince durur.
 */
export async function fetchStoreListingsViaApi(
  storeName: string,
  maxItems = 160,
): Promise<EbayApiItem[]> {
  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) throw new Error("EBAY_CLIENT_ID tanımlı değil");

  const out: EbayApiItem[] = [];
  const perPage = 100; // Finding API sayfa başına azami
  let page = 1;

  while (out.length < maxItems) {
    const params = new URLSearchParams({
      "OPERATION-NAME": "findItemsIneBayStores",
      "SERVICE-VERSION": "1.13.0",
      "SECURITY-APPNAME": appId,
      "RESPONSE-DATA-FORMAT": "JSON",
      "REST-PAYLOAD": "",
      storeName,
      "paginationInput.entriesPerPage": String(perPage),
      "paginationInput.pageNumber": String(page),
    });

    const res = await fetch(`${FINDING_URL}?${params.toString()}`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`eBay Finding API hatası: ${res.status} — ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as FindingResponse;
    const resp = data.findItemsIneBayStoresResponse?.[0];
    const ack = resp?.ack?.[0];
    if (ack !== "Success" && ack !== "Warning") {
      throw new Error(`eBay Finding API ack=${ack ?? "?"}: ${JSON.stringify(resp?.errorMessage ?? {}).slice(0, 200)}`);
    }

    const items = resp?.searchResult?.[0]?.item ?? [];
    if (items.length === 0) break;
    out.push(...parseFindingItems(items));

    const totalPages = parseInt(resp?.paginationOutput?.[0]?.totalPages?.[0] ?? "1", 10);
    if (page >= totalPages) break;
    page++;
  }

  return out.slice(0, maxItems);
}
