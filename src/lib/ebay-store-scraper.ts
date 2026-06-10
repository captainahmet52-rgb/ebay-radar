// eBay mağaza ürün listesi çekme — ScrapingBee API

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

export interface EbayStoreItem {
  title: string;
  price: number | null;
  itemId: string | null;
}

export async function fetchEbayStoreListing(
  ebayUsername: string,
  page = 1
): Promise<EbayStoreItem[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY tanımlı değil");

  const storeUrl = `https://www.ebay.com/sch/i.html?_ssn=${encodeURIComponent(ebayUsername)}&_pgn=${page}&_skc=${(page - 1) * 48}`;

  const extractRules = JSON.stringify({
    items: {
      selector: ".s-item",
      type: "list",
      output: {
        title:  ".s-item__title",
        price:  ".s-item__price",
        itemId: { selector: ".s-item__link", output: "@href" },
      },
    },
  });

  const params = new URLSearchParams({
    api_key: apiKey,
    url: storeUrl,
    render_js: "false",
    country_code: "us",
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee eBay store hatası: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ title?: string; price?: string; itemId?: string }>;
  };

  return (data.items ?? [])
    .filter(item => item.title && !item.title.includes("Shop on eBay"))
    .map(item => ({
      title: (item.title ?? "").replace(/^New Listing\s*/i, "").trim(),
      price: item.price ? parseFloat(item.price.replace(/[^0-9.]/g, "")) || null : null,
      itemId: item.itemId
        ? (item.itemId.match(/\/itm\/(\d+)/) ?? [])[1] ?? null
        : null,
    }));
}
