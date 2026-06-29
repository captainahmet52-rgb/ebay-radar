// eBay mağaza ürün listesi çekme — ScrapingBee API

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

export interface EbayStoreItem {
  title: string;
  price: number | null;
  itemId: string | null;
  imageUrl: string | null;
  soldCount: number | null; // "X sold" — talep sinyali (P5 para motoru)
}

// "1,234 sold" / "1.2K sold" → 1234. Bulunamazsa null.
export function parseSoldCount(text: string | undefined): number | null {
  if (!text) return null;
  const m = text.match(/([\d.,]+)\s*K?\s*sold/i);
  if (!m) return null;
  const raw = m[1].replace(/,/g, "");
  let n = parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (/K\s*sold/i.test(text)) n *= 1000; // "1.2K sold"
  return Math.round(n);
}

export async function fetchEbayStoreListing(
  ebayUsername: string,
  page = 1
): Promise<EbayStoreItem[]> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) throw new Error("SCRAPINGBEE_API_KEY tanımlı değil");

  const storeUrl = `https://www.ebay.com/sch/i.html?_ssn=${encodeURIComponent(ebayUsername)}&_pgn=${page}`;

  // eBay 2026 layout: arama sonuçları .s-item → .s-card (yeni BEM yapısı) oldu.
  const extractRules = JSON.stringify({
    items: {
      selector: ".s-card",
      type: "list",
      output: {
        title:  ".s-card__title",
        price:  ".s-card__price",
        itemId: { selector: "a.s-card__link", output: "@href" },
        // Ürün görseli (Faz 2 görsel kanıtı) — kart içindeki ilk img. render_js=true
        // ile src dolu gelir; boş gelirse görsel kanıt sessizce atlanır (güvenli).
        image:  { selector: "img", output: "@src" },
        // "X sold" talep sinyali (P5). Selector belirsiz olabilir → bulunamazsa null
        // (talep "bilinmiyor", kâr ile sıralanır). Layout değişirse ilk bakılacak yer.
        soldText: { selector: ".s-card__caption", output: "text" },
      },
    },
  });

  // eBay datacenter IP'lerini 403 ile engelliyor → render_js + premium_proxy ZORUNLU
  // (residential IP + JS challenge). render_js'siz veya premium'suz istek 403/500 döner.
  // Maliyet: ~25 kredi/sayfa (test edildi, çalışıyor).
  const params = new URLSearchParams({
    api_key: apiKey,
    url: storeUrl,
    render_js: "true",
    premium_proxy: "true",
    country_code: "us",
    extract_rules: extractRules,
  });

  const response = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`ScrapingBee eBay store hatası: ${response.status} — ${body}`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      title?: string;
      price?: string;
      itemId?: string;
      image?: string | string[];
      soldText?: string | string[];
    }>;
  };

  return (data.items ?? [])
    .filter(item => item.title && !item.title.includes("Shop on eBay"))
    .map(item => {
      const rawImage = Array.isArray(item.image) ? item.image[0] : item.image;
      const rawSold = Array.isArray(item.soldText) ? item.soldText.join(" ") : item.soldText;
      return {
        title: (item.title ?? "").replace(/^New Listing\s*/i, "").trim(),
        price: item.price ? parseFloat(item.price.replace(/[^0-9.]/g, "")) || null : null,
        itemId: item.itemId
          ? (item.itemId.match(/\/itm\/(\d+)/) ?? [])[1] ?? null
          : null,
        imageUrl: rawImage && /^https?:\/\//i.test(rawImage) ? rawImage : null,
        soldCount: parseSoldCount(rawSold),
      };
    });
}
