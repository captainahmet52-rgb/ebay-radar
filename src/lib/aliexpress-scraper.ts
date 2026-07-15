// AliExpress ürün sayfası — ScrapingBee ile fiyat/stok çekme.
// Resmi Dropshipping API onayı gelene kadarki GEÇİCİ yol. aliexpress.ts'teki
// fetchAliExpressProduct, resmi API yapılandırılmamışsa otomatik buraya düşer;
// API onaylanıp .env'e eklenince kod değişikliği GEREKMEDEN resmi API'ye döner.
//
// ⚠️ AliExpress'in sayfaya gömdüğü `window.runParams` JSON şeması canlı sayfayla
// doğrulanmadı (AliExpress bu şemayı zaman zaman değiştirir). İlk çalıştırmalarda
// worker loglarını izle — "fiyatı çözülemedi" hatası çok geliyorsa alan adlarını
// güncellemek gerekir (bkz. PRICE_PATHS / QTY_PATHS aşağıda).
import type { AliStockStatus } from "@/lib/amazon-repricer";
import { parseLocaleNumber } from "@/lib/scraper";
import type { AliProductData } from "@/lib/aliexpress";

const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";

export class AliScraperOutOfCreditsError extends Error {
  constructor(detail = "") {
    super(`ScrapingBee kotası bitti${detail ? `: ${detail}` : ""}`);
    this.name = "AliScraperOutOfCreditsError";
  }
}

async function fetchRawHtml(
  apiKey: string,
  url: string,
  opts: { renderJs: boolean; premiumProxy: boolean }
): Promise<string> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render_js: opts.renderJs ? "true" : "false",
    ...(opts.premiumProxy ? { premium_proxy: "true" } : {}),
  });

  const res = await fetch(`${SCRAPINGBEE_URL}?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 402) throw new AliScraperOutOfCreditsError(body.slice(0, 200));
    throw new Error(`ScrapingBee API hatası: ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.text();
}

/** Sayfaya gömülü `window.runParams = {...};` JSON'unu çıkarır. */
function extractRunParams(html: string): Record<string, unknown> | null {
  const m = html.match(/window\.runParams\s*=\s*(\{[\s\S]*?\})\s*;\s*(?:<\/script>|\r?\n\s*window\.)/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function parseStockFromQty(qty: unknown): { status: AliStockStatus; qty: number | null } {
  const n = typeof qty === "number" ? qty : Number(qty);
  if (!Number.isFinite(n)) return { status: "unknown", qty: null };
  if (n <= 0) return { status: "out", qty: 0 };
  if (n < 3) return { status: "low", qty: n };
  return { status: "in_stock", qty: n };
}

function firstDefined(...vals: unknown[]): unknown {
  return vals.find((v) => v !== undefined && v !== null);
}

/**
 * ScrapingBee ile AliExpress ürün sayfasını çeker, fiyat/stok/başlık çıkarır.
 * Maliyet kontrolü: önce EN UCUZ istek denenir (JS render yok), engellenirse JS
 * render ile, o da engellenirse premium proxy ile (en pahalı) tekrar dener —
 * çoğu istek en ucuz kademede başarılı olacağı için ortalama maliyet düşük kalır.
 */
export async function fetchAliExpressProductViaScraper(aliId: string): Promise<AliProductData> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) {
    throw new Error("SCRAPINGBEE_API_KEY .env'de tanımlı değil — ne resmi API ne scraper çalışabilir");
  }

  const url = `https://www.aliexpress.com/item/${aliId}.html`;

  const attempts = [
    { renderJs: false, premiumProxy: false },
    { renderJs: true, premiumProxy: false },
    { renderJs: true, premiumProxy: true },
  ];

  let params: Record<string, unknown> | null = null;
  for (const [i, opts] of attempts.entries()) {
    const html = await fetchRawHtml(apiKey, url, opts);
    params = extractRunParams(html);
    if (params) break;
    if (i < attempts.length - 1) {
      console.warn(`[aliexpress-scraper] ${aliId}: kademe ${i + 1} runParams bulamadı, bir üst kademe deneniyor`);
    }
  }

  if (!params) {
    throw new Error(`AliExpress sayfası çözülemedi (runParams yok, tüm kademeler denendi): ${aliId}`);
  }

  const data = params["data"] as Record<string, unknown> | undefined;

  // Fiyat: AliExpress sürümüne göre birkaç olası alan (defensif — biri tutar).
  const priceRaw = firstDefined(
    getPath(data, ["priceModule", "minActivityAmount", "value"]),
    getPath(data, ["priceModule", "minAmount", "value"]),
    getPath(data, ["priceModule", "formatedActivityPrice"]),
    getPath(data, ["priceModule", "formatedPrice"])
  );
  const costUsd =
    typeof priceRaw === "number" ? priceRaw : parseLocaleNumber(String(priceRaw ?? "")) ?? 0;

  if (!costUsd || costUsd <= 0) {
    throw new Error(`AliExpress fiyatı çözülemedi (scraper): ${aliId}`);
  }

  const qtyRaw = firstDefined(
    getPath(data, ["quantityModule", "totalAvailQuantity"]),
    getPath(data, ["inventoryModule", "totalAvailQuantity"])
  );
  const { status: stockStatus, qty: stockQty } = parseStockFromQty(qtyRaw);

  const title = firstDefined(
    getPath(data, ["titleModule", "subject"]),
    getPath(data, ["pageModule", "title"])
  ) as string | undefined;

  return {
    costUsd,
    // Kargo maliyeti bu sayfa çekiminden güvenilir alınamıyor (adrese göre değişiyor,
    // ayrı bir JS çağrısı gerektiriyor) — çoğu dropship ürünü "ücretsiz kargo" olduğu
    // için 0 varsayıyoruz. Canlı testte gerekirse ayrı bir kargo tahmini eklenir.
    shippingUsd: 0,
    stockStatus,
    stockQty,
    title,
  };
}
