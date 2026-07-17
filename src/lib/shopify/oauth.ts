// Shopify OAuth — mağaza bağlama akışı.
//
// Akış: /api/shopify/connect?shop=magaza.myshopify.com → Shopify izin ekranı →
// /api/shopify/callback?code&hmac&shop&state → HMAC + state doğrula → code'u
// kalıcı (offline) access token ile değiştir → ShopifyAccount kaydet (şifreli).
//
// "API en sonda" deseni (SP-API ile aynı): SHOPIFY_APP_KEY/SECRET env'de yoksa
// isShopifyConfigured() false döner, connect ucu 503 verir; anahtar girilince
// kod değişikliği olmadan çalışır. Uygulama Shopify Partners panelinden açılır
// (Dev/Custom app), gerekli scope'lar aşağıda.

import { createHmac, timingSafeEqual } from "crypto";

/** Admin API izinleri: ürün yaz/oku, stok yaz/oku, sipariş oku. */
export const SHOPIFY_SCOPES = "read_products,write_products,read_inventory,write_inventory,read_orders";

export function isShopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_APP_KEY && process.env.SHOPIFY_APP_SECRET);
}

function getAppKey(): string {
  const v = process.env.SHOPIFY_APP_KEY;
  if (!v) throw new Error("SHOPIFY_APP_KEY .env'de tanımlı değil");
  return v;
}

function getAppSecret(): string {
  const v = process.env.SHOPIFY_APP_SECRET;
  if (!v) throw new Error("SHOPIFY_APP_SECRET .env'de tanımlı değil");
  return v;
}

/**
 * Mağaza domain'ini doğrular ve normalize eder.
 * Kabul: "magaza.myshopify.com" veya sadece "magaza" (eki biz ekleriz).
 * SSRF/açık yönlendirme koruması: yalnız *.myshopify.com desenine izin verilir.
 */
export function normalizeShopDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const domain = raw.endsWith(".myshopify.com") ? raw : `${raw}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

/** Shopify izin (consent) ekranı URL'i. */
export function buildAuthorizeUrl(shopDomain: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getAppKey(),
    scope: SHOPIFY_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Callback query'sinin HMAC imzasını doğrular (Shopify şartı).
 * hmac parametresi HARİÇ tüm parametreler alfabetik sırayla key=value&... birleştirilir,
 * app secret ile HMAC-SHA256'sı hex olarak hmac değeriyle karşılaştırılır.
 */
export function verifyCallbackHmac(searchParams: URLSearchParams): boolean {
  const provided = searchParams.get("hmac");
  if (!provided) return false;

  const pairs: string[] = [];
  const keys = Array.from(new Set(Array.from(searchParams.keys()))).filter((k) => k !== "hmac").sort();
  for (const key of keys) {
    for (const value of searchParams.getAll(key)) {
      pairs.push(`${key}=${value}`);
    }
  }
  const message = pairs.join("&");
  const digest = createHmac("sha256", getAppSecret()).update(message).digest("hex");

  const a = Buffer.from(digest);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Authorization code → kalıcı (offline) Admin API access token. */
export async function exchangeCodeForToken(shopDomain: string, code: string): Promise<string> {
  const res = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getAppKey(),
      client_secret: getAppSecret(),
      code,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shopify token değişimi hatası: ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Shopify access token dönmedi");
  return data.access_token;
}
