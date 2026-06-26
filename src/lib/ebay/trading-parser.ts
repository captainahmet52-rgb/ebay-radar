// eBay Trading API (XML) yanıt ayrıştırıcı — SAF fonksiyon, ağ/env yok.
//
// Neden ayrı dosya: Trading API yanıtı XML'dir ve ayrıştırma en kırılgan kısımdır.
// Burayı tamamen saf (network'süz) tutarak fixture XML'lerle %100 test edebiliyoruz
// — canlı eBay hesabı olmadan bile. Ağ çağrısı trading.ts'te, bu modülü kullanır.
//
// GetMyeBaySelling yanıt yapısı (ActiveList):
//   GetMyeBaySellingResponse > ActiveList > ItemArray > Item[]
//   Item: ItemID, SKU?, Title, Quantity, SellingStatus{CurrentPrice@currencyID, QuantitySold},
//         PictureDetails{GalleryURL?}, Site?
//   Pagination: ActiveList > PaginationResult{TotalNumberOfPages, TotalNumberOfEntries}

import { XMLParser } from "fast-xml-parser";

// parseTagValue:false → her şey string kalır. ItemID gibi büyük sayıların
// kayan-nokta hassasiyetini KAYBETMEMEK için kritik; sayıları biz elle parse ederiz.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

export interface ParsedEbayListing {
  ebayItemId: string;
  ebaySku: string | null;
  title: string | null;
  price: number | null;
  currency: string;
  quantityAvailable: number | null;
  imageUrl: string | null;
  site: string | null;
}

export interface ParsedListingsPage {
  // Success | Warning | Failure | Unknown
  ack: string;
  listings: ParsedEbayListing[];
  totalPages: number | null;
  totalEntries: number | null;
  errors: string[];
}

// ─── Küçük yardımcılar (fast-xml-parser şekline dayanıklı) ──────────────────────

type XmlNode = unknown;

/** Tek eleman obje, çok eleman dizi döner; ikisini de diziye normalize eder. */
function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Düğümün metin değeri: ya düz string ya { "#text": "..." } (attribute'lu düğüm). */
function textOf(node: XmlNode): string | null {
  if (node === null || node === undefined) return null;
  if (typeof node === "string") return node.trim() === "" ? null : node;
  if (typeof node === "number" || typeof node === "boolean") return String(node);
  if (typeof node === "object") {
    const t = (node as Record<string, unknown>)["#text"];
    if (typeof t === "string") return t.trim() === "" ? null : t;
    if (typeof t === "number") return String(t);
  }
  return null;
}

/** Attribute değeri: { "@_currencyID": "USD" } → attrOf(node,"currencyID") = "USD". */
function attrOf(node: XmlNode, name: string): string | null {
  if (node && typeof node === "object") {
    const v = (node as Record<string, unknown>)[`@_${name}`];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

function toInt(node: XmlNode): number | null {
  const s = textOf(node);
  if (s === null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(s: string | null): number | null {
  if (s === null) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Bir <Item> düğümünü düz ParsedEbayListing'e çevirir. */
function mapItem(item: Record<string, unknown>): ParsedEbayListing | null {
  const ebayItemId = textOf(item.ItemID);
  // ItemID olmadan ilan anlamsız — atla (parser çağıranı kirletmesin)
  if (!ebayItemId) return null;

  const sellingStatus = (item.SellingStatus ?? {}) as Record<string, unknown>;
  const currentPrice = sellingStatus.CurrentPrice;
  const price = toFloat(textOf(currentPrice));
  const currency = attrOf(currentPrice, "currencyID") ?? "USD";

  // Mevcut adet = listelenen toplam − satılan
  const total = toInt(item.Quantity);
  const sold = toInt(sellingStatus.QuantitySold) ?? 0;
  const quantityAvailable = total !== null ? Math.max(0, total - sold) : null;

  const pictureDetails = (item.PictureDetails ?? {}) as Record<string, unknown>;
  const imageUrl = textOf(pictureDetails.GalleryURL);

  return {
    ebayItemId,
    ebaySku: textOf(item.SKU),
    title: textOf(item.Title),
    price,
    currency,
    quantityAvailable,
    imageUrl,
    site: textOf(item.Site),
  };
}

/** Errors düğümünden okunur hata mesajları çıkarır. */
function extractErrors(root: Record<string, unknown>): string[] {
  const errors = toArray(root.Errors as XmlNode);
  const out: string[] = [];
  for (const e of errors) {
    if (e && typeof e === "object") {
      const obj = e as Record<string, unknown>;
      const msg = textOf(obj.LongMessage) ?? textOf(obj.ShortMessage);
      const code = textOf(obj.ErrorCode);
      if (msg) out.push(code ? `[${code}] ${msg}` : msg);
    }
  }
  return out;
}

/**
 * GetMyeBaySelling XML yanıtını ayrıştırır.
 * @param xml   Ham XML metni (eBay'den dönen body)
 * @param container Hangi liste: ActiveList (varsayılan) | SoldList | UnsoldList | ScheduledList
 */
export function parseGetMyeBaySellingResponse(
  xml: string,
  container: string = "ActiveList"
): ParsedListingsPage {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { ack: "Failure", listings: [], totalPages: null, totalEntries: null, errors: ["XML ayrıştırılamadı"] };
  }

  const root = (parsed.GetMyeBaySellingResponse ?? {}) as Record<string, unknown>;
  const ack = textOf(root.Ack) ?? "Unknown";
  const errors = extractErrors(root);

  const list = (root[container] ?? {}) as Record<string, unknown>;
  const pagination = (list.PaginationResult ?? {}) as Record<string, unknown>;
  const totalPages = toInt(pagination.TotalNumberOfPages);
  const totalEntries = toInt(pagination.TotalNumberOfEntries);

  const itemArray = (list.ItemArray ?? {}) as Record<string, unknown>;
  const rawItems = toArray(itemArray.Item as XmlNode);
  const listings: ParsedEbayListing[] = [];
  for (const raw of rawItems) {
    if (raw && typeof raw === "object") {
      const mapped = mapItem(raw as Record<string, unknown>);
      if (mapped) listings.push(mapped);
    }
  }

  return { ack, listings, totalPages, totalEntries, errors };
}

export interface TradingAck {
  // Success | Warning | Failure | Unknown
  ack: string;
  errors: string[];
}

/**
 * Yazma çağrılarının (ReviseInventoryStatus vb.) yanıtından sadece Ack + hata çıkarır.
 * Hangi *Response kökü olduğu önemli değil; ilk kök düğüm içinden Ack/Errors okunur.
 */
export function parseTradingAck(xml: string): TradingAck {
  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return { ack: "Failure", errors: ["XML ayrıştırılamadı"] };
  }
  // İlk *Response kökünü bul (xml deklarasyonu parse'ta görünmez)
  const rootKey = Object.keys(parsed).find((k) => k.endsWith("Response"));
  const root = (rootKey ? parsed[rootKey] : {}) as Record<string, unknown>;
  const ack = textOf(root.Ack) ?? "Unknown";
  return { ack, errors: extractErrors(root) };
}
