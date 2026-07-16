// eBay Trading API (XML) HTTP istemcisi — mevcut ilanları çekmek için.
//
// NEDEN gerekli: REST Inventory API yalnız bizim oluşturduğumuz inventory item'ları
// görür. Satıcının başka araçla/elle açtığı MEVCUT ilanlar (legacy) orada görünmez.
// Trading API GetMyeBaySelling > ActiveList ise satıcının yayında olan TÜM ilanlarını
// (ItemID, SKU, başlık, fiyat, adet) döndürür — import'un kilidini açan parça budur.
//
// Auth: OAuth kullanıcı access token'ı X-EBAY-API-IAF-TOKEN header'ı ile gönderilir
// (legacy Auth'n'Auth gerekmez). Token getValidToken'dan gelir, ASLA loglanmaz.
//
// Ayrıştırma trading-parser.ts'te (saf, test edilebilir). Bu dosya yalnız ağ + XML
// istek gövdesi üretimini yapar.

import {
  parseGetMyeBaySellingResponse,
  parseTradingAck,
  type ParsedListingsPage,
} from "@/lib/ebay/trading-parser";

const COMPATIBILITY_LEVEL = "1193";
const MAX_RETRIES = 3;

function getApiUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com/ws/api.dll"
    : "https://api.ebay.com/ws/api.dll";
}

// eBay marketplace → Trading API SiteID
const SITE_IDS: Record<string, string> = {
  EBAY_US: "0",
  EBAY_GB: "3",
  EBAY_CA: "2",
  EBAY_AU: "15",
  EBAY_DE: "77",
};

export function siteIdForMarketplace(marketplace: string): string {
  return SITE_IDS[marketplace] ?? "0";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
}

/**
 * Düşük seviye Trading API çağrısı: header'ları kurar, 429/5xx'te backoff retry yapar,
 * ham XML metnini döndürür. Token/secret ASLA loglanmaz.
 */
async function tradingCall(
  callName: string,
  marketplace: string,
  accessToken: string,
  body: string
): Promise<string> {
  const url = getApiUrl();
  let attempt = 0;
  for (;;) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-EBAY-API-CALL-NAME": callName,
        "X-EBAY-API-SITEID": siteIdForMarketplace(marketplace),
        "X-EBAY-API-COMPATIBILITY-LEVEL": COMPATIBILITY_LEVEL,
        "X-EBAY-API-IAF-TOKEN": accessToken,
        "Content-Type": "text/xml",
      },
      body,
      // Trading API (XML) görselli isteklerde yavaş olabilir — yine de sınırla
      signal: AbortSignal.timeout(60_000),
    });

    if (response.ok) {
      return response.text();
    }

    const status = response.status;
    const retryable = status === 429 || status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      await sleep(backoffMs(attempt));
      attempt += 1;
      continue;
    }
    throw new Error(`eBay Trading API hatası [${callName}]: ${status} ${response.statusText}`);
  }
}

/** GetMyeBaySelling ActiveList istek gövdesi (XML). Sadece sabit + sayısal alan — injection yok. */
function buildActiveListRequest(pageNumber: number, entriesPerPage: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${entriesPerPage}</EntriesPerPage>
      <PageNumber>${pageNumber}</PageNumber>
    </Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>`;
}

export interface FetchActiveListingsOptions {
  accessToken: string;
  marketplace: string; // EBAY_US | EBAY_GB | ...
  pageNumber: number;
  entriesPerPage?: number; // max 200
}

/**
 * Satıcının aktif ilanlarının BİR sayfasını çeker (Trading API GetMyeBaySelling).
 * 429/5xx → backoff retry. Auth hatası (Ack=Failure) → parse sonucu döner, çağıran karar verir.
 */
export async function fetchActiveListingsPage(
  opts: FetchActiveListingsOptions
): Promise<ParsedListingsPage> {
  const { accessToken, marketplace, pageNumber } = opts;
  const entriesPerPage = Math.min(opts.entriesPerPage ?? 200, 200);
  const body = buildActiveListRequest(pageNumber, entriesPerPage);
  const xml = await tradingCall("GetMyeBaySelling", marketplace, accessToken, body);
  return parseGetMyeBaySellingResponse(xml, "ActiveList");
}

/** ReviseInventoryStatus istek gövdesi — ItemID + adet (+ varsa fiyat). Sadece sayısal alan. */
export function buildReviseInventoryStatusRequest(
  itemId: string,
  qty: number,
  price: number | null
): string {
  // ItemID eBay'den gelir ve SAYISALDIR. Defense-in-depth: sayısal değilse XML'e gömme.
  if (!/^\d+$/.test(itemId)) {
    throw new Error(`Geçersiz eBay ItemID (sayısal değil): ${itemId.slice(0, 40)}`);
  }
  // qty/price sayısal, kullanıcı-girdisi yok → injection yok.
  const startPrice = price !== null && price > 0 ? `\n      <StartPrice>${price.toFixed(2)}</StartPrice>` : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <InventoryStatus>
      <ItemID>${itemId}</ItemID>
      <Quantity>${Math.max(0, Math.floor(qty))}</Quantity>${startPrice}
  </InventoryStatus>
</ReviseInventoryStatusRequest>`;
}

export interface ReviseResult {
  ok: boolean;
  ack: string;
  errors: string[];
}

/**
 * ESKİ (legacy) bir eBay ilanının fiyat/stoğunu Trading API ile günceller.
 * Inventory API legacy ilanları yazamaz → bu yol kullanılır.
 * qty 0 → ilan fiilen duraklatılır (oversell koruması). price null → sadece stok güncellenir.
 * Ack Failure/partial-failure → ok=false döner (çağıran retry/işaretleme yapar).
 */
export async function reviseInventoryStatus(
  accessToken: string,
  marketplace: string,
  itemId: string,
  price: number | null,
  qty: number
): Promise<ReviseResult> {
  const body = buildReviseInventoryStatusRequest(itemId, qty, price);
  const xml = await tradingCall("ReviseInventoryStatus", marketplace, accessToken, body);
  const { ack, errors } = parseTradingAck(xml);
  const ok = ack === "Success" || ack === "Warning";
  return { ok, ack, errors };
}
