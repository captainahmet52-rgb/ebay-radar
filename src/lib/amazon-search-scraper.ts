// Amazon arama sayfasından ASIN toplama — ScrapingBee API

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

export interface AmazonSearchResult {
  asin: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
}

const AMAZON_SEARCH_DOMAINS: Record<string, { domain: string; country: string }> = {
  US: { domain: "https://www.amazon.com",    country: "us" },
  UK: { domain: "https://www.amazon.co.uk", country: "gb" },
};

// ScrapingBee'nin döndürdüğü ham ürün — her fiyat alanı string ya da string[] olabilir.
export interface RawAmazonProduct {
  asin?: string | string[];
  title?: string;
  // Birden fazla fiyat seçicisi: biri boşsa diğeri tutturur (tek seçici kırılgandı).
  priceBase?: string | string[];     // [data-a-color='base'] .a-offscreen — GÜNCEL fiyat
  priceOff?: string | string[];      // .a-price .a-offscreen — herhangi a-price
  priceWhole?: string | string[];    // .a-price-whole — tam kısım
  priceFraction?: string | string[]; // .a-price-fraction — kuruş kısmı
  imageUrl?: string | string[];
}

function firstStr(v?: string | string[]): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

// "$1,299.00" / "12.99" / "1.234,56" → sayı. Geçersiz/sıfır → null.
function toNumber(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Amazon arama tile'ından fiyatı SAĞLAM çıkarır — birden çok seçiciyi sırayla dener.
 * Tek seçici (.a-offscreen) bazı tile'larda (çoklu-paket, varyasyon, parçalı fiyat)
 * boş döner; bu sıra çoğu durumu kapatır. SAF — test edilebilir.
 */
export function pickAmazonPrice(p: RawAmazonProduct): number | null {
  // 1) güncel fiyat (base offscreen) — "was/list" fiyatından ayrı, en güvenilir
  const base = toNumber(firstStr(p.priceBase));
  if (base) return base;

  // 2) herhangi a-price offscreen
  const off = toNumber(firstStr(p.priceOff));
  if (off) return off;

  // 3) parçalı: whole + fraction ("12" + "99" → 12.99)
  const whole = firstStr(p.priceWhole).replace(/[^0-9]/g, "");
  if (whole) {
    const frac = firstStr(p.priceFraction).replace(/[^0-9]/g, "");
    const combined = toNumber(frac ? `${whole}.${frac}` : whole);
    if (combined) return combined;
  }

  return null;
}

export async function searchAmazonProducts(
  keyword: string,
  page = 1,
  market: "US" | "UK" = "US"
): Promise<AmazonSearchResult[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY tanımlı değil");

  const { domain, country } = AMAZON_SEARCH_DOMAINS[market] ?? AMAZON_SEARCH_DOMAINS.US;
  const searchUrl = `${domain}/s?k=${encodeURIComponent(keyword)}&page=${page}`;

  const extractRules = JSON.stringify({
    products: {
      selector: "[data-component-type='s-search-result']",
      type: "list",
      output: {
        asin:     { selector: "[data-asin]", output: "@data-asin" },
        // Amazon 2026: başlık artık h2 .a-text-normal değil; h2 metni güvenilir.
        title:    "h2",
        // ÇOKLU fiyat seçicisi — biri boşsa diğeri tutturur (pickAmazonPrice sırayla dener).
        priceBase:     { selector: "[data-a-color='base'] .a-offscreen" },
        priceOff:      ".a-price .a-offscreen",
        priceWhole:    ".a-price-whole",
        priceFraction: ".a-price-fraction",
        imageUrl: { selector: ".s-image", output: "@src" },
      },
    },
  });

  const params = new URLSearchParams({
    api_key: apiKey,
    url: searchUrl,
    render_js: "false",
    country_code: country,
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee Amazon search hatası: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as { products?: RawAmazonProduct[] };

  return (data.products ?? [])
    .map(p => {
      const asin = Array.isArray(p.asin) ? p.asin[0] : p.asin;
      if (!asin || asin.trim() === "") return null;
      const price = pickAmazonPrice(p);
      const imageUrl = Array.isArray(p.imageUrl) ? p.imageUrl[0] : (p.imageUrl ?? null);
      return {
        asin: asin.trim(),
        title: (p.title ?? "").trim(),
        price,
        imageUrl: imageUrl ?? null,
      };
    })
    .filter((p): p is AmazonSearchResult => p !== null && p.asin.length > 0);
}
