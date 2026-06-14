// Amazon ürün verisi çekme — ScrapingBee API
import type { ScraperResult, StockStatus } from "@/types";

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

function parsePrice(raw: string | string[] | null | undefined): number | null {
  // ScrapingBee bazen array döner — ilk elemanı al
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  // "$149.99" veya "149.99" → sayısal kısım
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function parseStock(availability: string | null | undefined): {
  stockStatus: StockStatus;
  stockQty: number | null;
} {
  // Boş veya parse edilemeyen → unknown. In_stock VARSAYILMAZ.
  if (!availability || availability.trim() === "") {
    return { stockStatus: "unknown", stockQty: null };
  }

  const text = availability.toLowerCase().trim();

  // Tükendi / kullanılamaz
  if (
    text.includes("unavailable") ||
    text.includes("out of stock") ||
    text.includes("currently unavailable") ||
    text.includes("not available") ||
    text.includes("sold out")
  ) {
    return { stockStatus: "out", stockQty: null };
  }

  // "Only N left in stock"
  const onlyNMatch = text.match(/only\s+(\d+)\s+left/i);
  if (onlyNMatch) {
    const qty = parseInt(onlyNMatch[1], 10);
    return { stockStatus: "low", stockQty: qty };
  }

  // "N left in stock"
  const nLeftMatch = text.match(/(\d+)\s+left\s+in\s+stock/i);
  if (nLeftMatch) {
    const qty = parseInt(nLeftMatch[1], 10);
    return { stockStatus: "low", stockQty: qty };
  }

  // Net "in stock" / "available" ifadesi
  if (text.includes("in stock") || text.includes("ships") || text.includes("available")) {
    return { stockStatus: "in_stock", stockQty: null };
  }

  // Tanımsız metin — güvenli taraf: unknown
  console.warn(`[scraper] Bilinmeyen stok metni, unknown döndürülüyor: "${availability}"`);
  return { stockStatus: "unknown", stockQty: null };
}

const AMAZON_DOMAINS: Record<string, { url: string; country: string }> = {
  US: { url: "https://www.amazon.com",    country: "us" },
  UK: { url: "https://www.amazon.co.uk", country: "gb" },
};

export async function fetchAmazonProduct(
  asin: string,
  market: "US" | "UK" = "US"
): Promise<ScraperResult> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY .env'de tanımlı değil");
  }

  const { url: domain, country } = AMAZON_DOMAINS[market] ?? AMAZON_DOMAINS.US;
  const targetUrl = `${domain}/dp/${asin}`;

  // Fiyat seçici öncelik sırası (Amazon sayfa yapısı versiyonlarına göre):
  //   1. .apexPriceToPay — güncel buy-box (JS render sonrası görünür)
  //   2. #corePrice_feature_div .a-price — container bazlı
  //   3. #priceblock_ourprice — eski format fallback
  const extractRules = JSON.stringify({
    price_apex:       ".apexPriceToPay .a-offscreen",
    price_buybox:     "#corePrice_feature_div .a-price .a-offscreen",
    price_legacy:     "#priceblock_ourprice",
    availability:     "#availability span",
    title:            "#productTitle",
    image:            "#landingImage",
  });

  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    render_js: "true",
    country_code: country,
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `ScrapingBee API hatası: ${response.status} ${response.statusText} — ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    price_apex?:    string | string[] | null;
    price_buybox?:  string | string[] | null;
    price_legacy?:  string | string[] | null;
    availability?:  string | null;
    title?:         string | null;
    image?:         string | null;
  };

  // Buy-box fiyatını öncelik sırasıyla dene
  const price =
    parsePrice(data.price_apex) ??
    parsePrice(data.price_buybox) ??
    parsePrice(data.price_legacy);

  if (price === null) {
    console.warn(`[scraper] ASIN ${asin} için buy-box fiyatı parse edilemedi`);
  }

  const { stockStatus, stockQty } = parseStock(data.availability);

  const title = data.title?.trim() ?? "";
  const imageUrl = data.image ?? null;

  return {
    asin,
    title,
    imageUrl,
    price,
    stockStatus,
    stockQty,
  };
}
