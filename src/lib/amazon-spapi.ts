/**
 * Amazon SP-API istemcisi (iskelet).
 * Amazon, 2023'ten beri AWS SigV4 istemiyor — sadece LWA access token yeterli
 * (x-amz-access-token header). Burada: LWA token, pazar tespiti, marka kısıtı
 * (getListingsRestrictions) ve listeleme (putListingsItem).
 *
 * "API en sonda" kararı: gerçek istekler env (LWA client id/secret) bağlanınca çalışır;
 * env yoksa assertSpapiConfigured() net hata verir. Orkestrasyon/karar mantığı şimdiden gerçektir.
 */

const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

// SP-API bölge uç noktaları
const ENDPOINT_NA = "https://sellingpartnerapi-na.amazon.com";
const ENDPOINT_EU = "https://sellingpartnerapi-eu.amazon.com";

// Pazar anahtarı → { marketplaceId, endpoint }
export const SPAPI_MARKETS: Record<string, { marketplaceId: string; endpoint: string }> = {
  us: { marketplaceId: "ATVPDKIKX0DER",  endpoint: ENDPOINT_NA },
  uk: { marketplaceId: "A1F83G8C2ARO7P", endpoint: ENDPOINT_EU },
  ae: { marketplaceId: "A2VIGQ35RCS4UG", endpoint: ENDPOINT_EU },
  sa: { marketplaceId: "A17E79C6D8DWNP", endpoint: ENDPOINT_EU },
};

// marketplaceId → pazar anahtarı (pazar tespiti için ters harita)
const MARKETPLACE_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(SPAPI_MARKETS).map(([key, v]) => [v.marketplaceId, key])
);

function assertSpapiConfigured(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AMAZON_LWA_CLIENT_ID;
  const clientSecret = process.env.AMAZON_LWA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "SP-API yapılandırılmadı: AMAZON_LWA_CLIENT_ID / AMAZON_LWA_CLIENT_SECRET .env'de yok"
    );
  }
  return { clientId, clientSecret };
}

export function isSpapiConfigured(): boolean {
  return Boolean(process.env.AMAZON_LWA_CLIENT_ID && process.env.AMAZON_LWA_CLIENT_SECRET);
}

// ─── LWA access token ──────────────────────────────────────────────────────────

export interface SpapiToken {
  accessToken: string;
  expiresAt: Date;
}

/** Refresh token (düz metin) → kısa ömürlü access token. */
export async function getSpapiAccessToken(refreshToken: string): Promise<SpapiToken> {
  const { clientId, clientSecret } = assertSpapiConfigured();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`LWA token hatası: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/** spapi_oauth_code (yetkilendirme sonrası) → kalıcı refresh token. */
export async function exchangeSpapiCode(code: string, redirectUri: string): Promise<string> {
  const { clientId, clientSecret } = assertSpapiConfigured();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`LWA code değişimi hatası: ${res.status}`);
  const data = (await res.json()) as { refresh_token: string };
  return data.refresh_token;
}

// ─── İç HTTP yardımcı ──────────────────────────────────────────────────────────

async function spapiRequest<T>(
  market: string,
  accessToken: string,
  method: string,
  path: string,
  params?: Record<string, string>,
  body?: unknown
): Promise<T> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  let url = `${cfg.endpoint}${path}`;
  if (params && Object.keys(params).length) {
    url += `?${new URLSearchParams(params).toString()}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      // SP-API artık AWS SigV4 İSTEMİYOR — sadece LWA access token yeterli.
      "x-amz-access-token": accessToken,
      "x-amz-date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
      "user-agent": "LeanAutomation/1.0 (Language=TypeScript)",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SP-API hatası [${method} ${path}]: ${res.status} — ${txt}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── Pazar tespiti ─────────────────────────────────────────────────────────────

/**
 * Hesabın bağlı olduğu pazarı SP-API'den otomatik tespit eder.
 * getMarketplaceParticipations → desteklediğimiz ilk pazar anahtarı (us/uk/ae/sa).
 * Token zaten o bölgenin uç noktasına ait olmalı (NA vs EU).
 */
export async function detectMarketFromParticipations(
  region: "na" | "eu",
  accessToken: string
): Promise<string> {
  // İlk sorguda hangi pazar olduğunu bilmediğimiz için bölgenin bir anahtarını kullanıyoruz
  const probeMarket = region === "na" ? "us" : "uk";

  const data = await spapiRequest<{
    payload?: Array<{ marketplace?: { id?: string } }>;
  }>(probeMarket, accessToken, "GET", "/sellers/v1/marketplaceParticipations");

  for (const p of data.payload ?? []) {
    const id = p.marketplace?.id;
    if (id && MARKETPLACE_TO_KEY[id]) return MARKETPLACE_TO_KEY[id];
  }
  return probeMarket; // bulunamazsa bölgenin varsayılanı
}

// ─── Marka/kısıt kontrolü (ZORUNLU — yükleme öncesi) ─────────────────────────

export interface ListingRestriction {
  reasons?: Array<{ message?: string }>;
}

/**
 * getListingsRestrictions — ASIN bu satıcı/pazar için listelenebilir mi?
 * Dönen kısıt listesi BOŞSA listelenebilir. Doluysa (marka geçidi vb.) yükleme YAPILMAZ.
 */
export async function getListingsRestrictions(
  market: string,
  accessToken: string,
  sellerId: string,
  asin: string,
  conditionType = "new_new"
): Promise<{ allowed: boolean; reasons: string[] }> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  const data = await spapiRequest<{ restrictions?: ListingRestriction[] }>(
    market,
    accessToken,
    "GET",
    "/listings/2021-08-01/restrictions",
    { asin, conditionType, sellerId, marketplaceIds: cfg.marketplaceId }
  );

  const restrictions = data.restrictions ?? [];
  const reasons = restrictions.flatMap((r) =>
    (r.reasons ?? []).map((x) => x.message ?? "kısıtlı")
  );
  return { allowed: restrictions.length === 0, reasons };
}

// ─── Ürün tipi tespiti (putListingsItem için gerekli) ────────────────────────

/**
 * Başlık/anahtar kelimeden Amazon productType'ını bulur (searchDefinitionsProductTypes).
 * Bulunamazsa güvenli varsayılan "PRODUCT" döner.
 */
export async function searchProductType(
  market: string,
  accessToken: string,
  keywords: string
): Promise<string> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  try {
    const data = await spapiRequest<{ productTypes?: Array<{ name?: string }> }>(
      market,
      accessToken,
      "GET",
      "/definitions/2020-09-01/productTypes",
      { keywords: keywords.slice(0, 60), marketplaceIds: cfg.marketplaceId }
    );
    return data.productTypes?.[0]?.name ?? "PRODUCT";
  } catch {
    return "PRODUCT";
  }
}

// ─── Listeleme ─────────────────────────────────────────────────────────────────

export interface PutListingInput {
  sellerId: string;
  sku: string;
  productType: string; // ör. "PRODUCT" — gerçek productType ürün kategorisine göre
  attributes: Record<string, unknown>; // fiyat/qty/başlık/görsel SP-API attribute şeması
}

/**
 * putListingsItem — bir SKU'yu oluşturur/günceller.
 * NOT: attributes şeması ürün tipine göre değişir; çağıran tarafta hazırlanır.
 */
export async function putListingsItem(
  market: string,
  accessToken: string,
  input: PutListingInput
): Promise<{ status: string; sku: string }> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  const data = await spapiRequest<{ status?: string }>(
    market,
    accessToken,
    "PUT",
    `/listings/2021-08-01/items/${input.sellerId}/${encodeURIComponent(input.sku)}`,
    { marketplaceIds: cfg.marketplaceId },
    {
      productType: input.productType,
      requirements: "LISTING",
      attributes: input.attributes,
    }
  );

  return { status: data.status ?? "SUBMITTED", sku: input.sku };
}

// ─── Siparişler (getOrders) ──────────────────────────────────────────────────
// NOT: PII (alıcı adresi) için "Direct-to-Consumer Shipping (Restricted)" rolü +
// Restricted Data Token (RDT) gerekir. Sipariş listesi (adres hariç) normal token ile gelir.

export interface SpapiOrderSummary {
  amazonOrderId: string;
  orderStatus: string;
  purchaseDate?: string;
  orderTotal?: { amount: string; currencyCode: string };
}

/** Belirli tarihten sonra oluşturulan/güncellenen siparişleri çeker. */
export async function getOrders(
  market: string,
  accessToken: string,
  createdAfterIso: string
): Promise<SpapiOrderSummary[]> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  const data = await spapiRequest<{
    payload?: { Orders?: Array<Record<string, unknown>> };
  }>(market, accessToken, "GET", "/orders/v0/orders", {
    MarketplaceIds: cfg.marketplaceId,
    CreatedAfter: createdAfterIso,
  });

  return (data.payload?.Orders ?? []).map((o) => ({
    amazonOrderId: String(o["AmazonOrderId"] ?? ""),
    orderStatus: String(o["OrderStatus"] ?? "Unknown"),
    purchaseDate: o["PurchaseDate"] as string | undefined,
    orderTotal: o["OrderTotal"] as { amount: string; currencyCode: string } | undefined,
  }));
}

// ─── Kargo bildirimi (confirmShipment) ───────────────────────────────────────

/**
 * Geçerli takip numarasını Amazon'a bildirir (VTR için kritik).
 * Kullanıcı manuel girebilir; bu fonksiyon SP-API ile otomatik bildirim sağlar.
 */
export async function confirmShipment(
  market: string,
  accessToken: string,
  amazonOrderId: string,
  input: { carrierCode: string; trackingNumber: string; shipDateIso: string; items: Array<{ orderItemId: string; quantity: number }> }
): Promise<void> {
  const cfg = SPAPI_MARKETS[market];
  if (!cfg) throw new Error(`Geçersiz pazar: ${market}`);

  await spapiRequest(market, accessToken, "POST", `/orders/v0/orders/${amazonOrderId}/shipmentConfirmation`, undefined, {
    marketplaceId: cfg.marketplaceId,
    packageDetail: {
      packageReferenceId: `pkg-${amazonOrderId}`,
      carrierCode: input.carrierCode,
      trackingNumber: input.trackingNumber,
      shipDate: input.shipDateIso,
      orderItems: input.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })),
    },
  });
}
