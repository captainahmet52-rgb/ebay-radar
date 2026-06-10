// Amazon arama sayfasından ASIN toplama — ScrapingBee API

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

export interface AmazonSearchResult {
  asin: string;
  title: string;
  price: number | null;
  imageUrl: string | null;
}

export async function searchAmazonProducts(
  keyword: string,
  page = 1
): Promise<AmazonSearchResult[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY tanımlı değil");

  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&page=${page}`;

  const extractRules = JSON.stringify({
    products: {
      selector: "[data-component-type='s-search-result']",
      type: "list",
      output: {
        asin:     { selector: "[data-asin]", output: "@data-asin" },
        title:    "h2 .a-text-normal",
        price:    ".a-price .a-offscreen",
        imageUrl: { selector: ".s-image", output: "@src" },
      },
    },
  });

  const params = new URLSearchParams({
    api_key: apiKey,
    url: searchUrl,
    render_js: "false",
    country_code: "us",
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee Amazon search hatası: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as {
    products?: Array<{
      asin?: string | string[];
      title?: string;
      price?: string;
      imageUrl?: string | string[];
    }>;
  };

  return (data.products ?? [])
    .map(p => {
      const asin = Array.isArray(p.asin) ? p.asin[0] : p.asin;
      if (!asin || asin.trim() === "") return null;
      const priceStr = p.price ?? "";
      const price = parseFloat(priceStr.replace(/[^0-9.]/g, "")) || null;
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
