// Amazon ürün verisi çekme — ScrapingBee API
import type { ScraperResult, StockStatus } from "@/types";

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

/** ScrapingBee kotası/kredisi bitti (402). Çağıran taraf admin'e bildirir. */
export class ScraperOutOfCreditsError extends Error {
  constructor(detail = "") {
    super(`ScrapingBee kotası bitti${detail ? `: ${detail}` : ""}`);
    this.name = "ScraperOutOfCreditsError";
  }
}

function parsePrice(raw: string | string[] | null | undefined): number | null {
  // ScrapingBee bazen array döner — ilk elemanı al
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  // "$149.99" / "149,99 €" / "2.249,00 TL" → çok-yerelli sayı
  return parseLocaleNumber(value);
}

/** "1,234.56" (US) ve "1.234,56" (AB/TR) formatlarını doğru okur. */
export function parseLocaleNumber(text: string): number | null {
  const m = String(text).match(/[\d.,]+/);
  if (!m) return null;
  let r = m[0];
  const dot = r.lastIndexOf(".");
  const comma = r.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const dec = dot > comma ? "." : ",";
    const thou = dec === "." ? "," : ".";
    r = r.split(thou).join("");
    if (dec === ",") r = r.replace(",", ".");
  } else if (comma >= 0) {
    // Son virgülden sonra 3 hane → binlik ayraç (1,500→1500). 1-2 hane → ondalık
    // (1,5→1.5 ve 1,50→1.50). Tek-ondalığı yanlış 10x yapmamak için kritik.
    r = r.length - comma - 1 === 3 ? r.replace(/,/g, "") : r.replace(",", ".");
  } else if (dot >= 0) {
    // Son noktadan sonra 3 hane → binlik ayraç (1.500→1500). 1-2 hane → ondalık (1.5/1.50, dokunma).
    if (r.length - dot - 1 === 3) r = r.replace(/\./g, "");
  }
  const v = parseFloat(r);
  return Number.isFinite(v) && v > 0 ? v : null;
}

// ── Çok-dilli stok ifadeleri (US/UK/TR/DE/FR/IT/ES/CA) ──
const OUT_OF_STOCK_PATTERNS = [
  "unavailable", "out of stock", "currently unavailable", "not available", "sold out",
  "mevcut değil", "stokta yok", "tükendi", "satışta değil",
  "nicht verfügbar", "nicht auf lager", "ausverkauft", "derzeit nicht",
  "indisponible", "rupture de stock", "épuisé",
  "non disponibile", "esaurito",
  "no disponible", "agotado",
];
const IN_STOCK_PATTERNS = [
  "in stock", "available", "ships", "usually ships",
  "stokta", "mevcut", "kargoya",
  "auf lager", "verfügbar", "lieferbar",
  "en stock", "disponible", "expédié",
  "disponibile",
];
// "Sadece N adet kaldı" tüm dillerde
const ONLY_N_PATTERNS = [
  /only\s+(\d+)\s+left/i,
  /(\d+)\s+left\s+in\s+stock/i,
  /son\s+(\d+)\s+adet/i,
  /sadece\s+(\d+)\s+adet/i,
  /stokta\s+(\d+)\s+adet/i,
  /nur\s+noch\s+(\d+)/i,
  /(?:ne\s+reste\s+plus\s+que|plus\s+que)\s+(\d+)/i,
  /(?:solo|quedan)\D{0,12}(\d+)/i,
  /(?:solo|ancora)\s+(\d+)/i,
];

export function parseStock(availability: string | null | undefined): {
  stockStatus: StockStatus;
  stockQty: number | null;
} {
  if (!availability || availability.trim() === "") {
    return { stockStatus: "unknown", stockQty: null };
  }
  const text = availability.toLowerCase().trim();

  // 1. Tükendi
  if (OUT_OF_STOCK_PATTERNS.some((p) => text.includes(p))) {
    return { stockStatus: "out", stockQty: null };
  }
  // 2. "Sadece N adet"
  for (const re of ONLY_N_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const qty = parseInt(m[1], 10);
      if (Number.isFinite(qty)) return { stockStatus: "low", stockQty: qty };
    }
  }
  // 3. Stokta
  if (IN_STOCK_PATTERNS.some((p) => text.includes(p))) {
    return { stockStatus: "in_stock", stockQty: null };
  }
  // 4. Tanımsız → güvenli taraf
  console.warn(`[scraper] Bilinmeyen stok metni, unknown: "${availability}"`);
  return { stockStatus: "unknown", stockQty: null };
}

export interface ScraperUsage {
  used: number;
  max: number;
  pct: number; // 0..1
}

/**
 * ScrapingBee kota kullanımı (kredi). Kota %80'i geçince admin uyarısı için kullanılır.
 * @throws yapılandırma yoksa veya API hatası
 */
export async function getScraperUsage(): Promise<ScraperUsage> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY tanımlı değil");

  const res = await fetch(`https://app.scrapingbee.com/api/v1/usage?api_key=${apiKey}`);
  if (!res.ok) {
    throw new Error(`ScrapingBee usage hatası: ${res.status}`);
  }
  const data = (await res.json()) as {
    max_api_credit?: number;
    used_api_credit?: number;
  };
  const max = data.max_api_credit ?? 0;
  const used = data.used_api_credit ?? 0;
  const pct = max > 0 ? used / max : 0;
  return { used, max, pct };
}

const AMAZON_DOMAINS: Record<string, { url: string; country: string }> = {
  US: { url: "https://www.amazon.com",     country: "us" },
  UK: { url: "https://www.amazon.co.uk",   country: "gb" },
  DE: { url: "https://www.amazon.de",      country: "de" },
  FR: { url: "https://www.amazon.fr",      country: "fr" },
  IT: { url: "https://www.amazon.it",      country: "it" },
  ES: { url: "https://www.amazon.es",      country: "es" },
  CA: { url: "https://www.amazon.ca",      country: "ca" },
  TR: { url: "https://www.amazon.com.tr",  country: "tr" },
};

interface ExtractedProductFields {
  price_apex?:      string | string[] | null;
  price_buybox?:    string | string[] | null;
  price_legacy?:    string | string[] | null;
  availability?:    string | null;
  title?:           string | null;
  image?:           string | null;
  buying_choices?:  string | null;
  merchant?:        string | null;
}

/**
 * Amazon ürün sayfası bot duvarına (captcha/robot check) takılmış mı?
 * Bot sayfasında ürün seçicilerinin hiçbiri eşleşmez → başlık da stok metni de boş.
 */
export function looksBlockedExtract(data: ExtractedProductFields): boolean {
  const noTitle = !data.title || data.title.trim() === "";
  const noAvailability = !data.availability || data.availability.trim() === "";
  return noTitle && noAvailability;
}

async function fetchExtractedFields(
  apiKey: string,
  targetUrl: string,
  country: string,
  extractRules: string,
  renderJs: boolean
): Promise<ExtractedProductFields> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    render_js: renderJs ? "true" : "false",
    country_code: country,
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    // 402 = kota/kredi bitti → özel hata (admin'e bildirilir)
    if (response.status === 402) {
      throw new ScraperOutOfCreditsError(errorBody.slice(0, 200));
    }
    // 429 = rate limit (retry edilebilir), diğerleri genel hata
    throw new Error(
      `ScrapingBee API hatası: ${response.status} ${response.statusText} — ${errorBody.slice(0, 200)}`
    );
  }

  return (await response.json()) as ExtractedProductFields;
}

export async function fetchAmazonProduct(
  asin: string,
  market: string = "US"
): Promise<ScraperResult> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY .env'de tanımlı değil");
  }

  const { url: domain, country } = AMAZON_DOMAINS[market] ?? AMAZON_DOMAINS.US;
  const targetUrl = `${domain}/dp/${asin}`;

  const extractRules = JSON.stringify({
    price_apex:       ".apexPriceToPay .a-offscreen",
    price_buybox:     "#corePrice_feature_div .a-price .a-offscreen",
    price_legacy:     "#priceblock_ourprice",
    availability:     "#availability span",
    title:            "#productTitle",
    image:            "#landingImage",
    // Buy-box yoksa "tüm satın alma seçenekleri" çıkar → Amazon doğrudan satmıyor
    buying_choices:   "#buybox-see-all-buying-choices, #buyBoxAccordion",
    // Satıcı bilgisi (Amazon mı 3. taraf mı)
    merchant:         "#sellerProfileTriggerId, #merchant-info, #tabular-buybox .tabular-buybox-text",
  });

  // Amazon ürün sayfaları SSR — önce JS'siz dene (1 kredi, JS'li 5 kredi).
  // Bot duvarına takılırsa bir kez JS render ile tekrarla (5 kredi).
  let data = await fetchExtractedFields(apiKey, targetUrl, country, extractRules, false);
  if (looksBlockedExtract(data)) {
    console.warn(`[scraper] ASIN ${asin}: statik istek bot duvarına takıldı → JS render ile tekrar`);
    data = await fetchExtractedFields(apiKey, targetUrl, country, extractRules, true);
  }

  const price =
    parsePrice(data.price_apex) ??
    parsePrice(data.price_buybox) ??
    parsePrice(data.price_legacy);

  let { stockStatus, stockQty } = parseStock(data.availability);

  // Buy-box doğrulaması: Amazon'da doğrudan buy-box yoksa (yalnız "diğer satıcılar"),
  // fiyat da okunamıyorsa güvenilir tedarik edemeyiz → "out" say (oversell koruması).
  const hasBuyingChoicesOnly =
    !!data.buying_choices && data.buying_choices.trim() !== "";
  if (hasBuyingChoicesOnly && price === null && stockStatus !== "out") {
    console.warn(`[scraper] ASIN ${asin}: buy-box yok (sadece diğer satıcılar) → out sayıldı`);
    stockStatus = "out";
    stockQty = null;
  }

  if (price === null && stockStatus === "in_stock") {
    // Stokta görünüyor ama fiyat okunamadı → güvenilmez, unknown'a düşür
    console.warn(`[scraper] ASIN ${asin}: stokta ama fiyat parse edilemedi → unknown`);
    stockStatus = "unknown";
  }

  return {
    asin,
    title: data.title?.trim() ?? "",
    imageUrl: data.image ?? null,
    price,
    stockStatus,
    stockQty,
  };
}
