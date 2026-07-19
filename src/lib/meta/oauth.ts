// Meta (Facebook/Instagram) Business OAuth — mağaza sahibinin Meta Business
// hesabını bağlaması. Şirket kuruldu (2026-07-18) → Marketing API kullanılabilir.
//
// Akış: /api/shopify/meta/connect?accountId=xxx → Meta izin ekranı →
// /api/shopify/meta/callback?code&state → state doğrula → code'u kısa ömürlü
// token ile değiştir → uzun ömürlü (60 gün) token'a çevir → reklam hesabı seç →
// MetaAccount kaydet (token şifreli).
//
// "API en sonda" deseni: META_APP_ID/SECRET env'de yoksa isMetaConfigured()
// false döner, connect ucu 503 verir; anahtar girilince kod değişmeden çalışır.

const GRAPH_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** ads_management: kampanya oluştur/yönet. pages_show_list + business_management: reklam kreatifi için Page ID. */
export const META_SCOPES = "ads_management,pages_show_list,business_management";

export function isMetaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function getAppId(): string {
  const v = process.env.META_APP_ID;
  if (!v) throw new Error("META_APP_ID .env'de tanımlı değil");
  return v;
}

function getAppSecret(): string {
  const v = process.env.META_APP_SECRET;
  if (!v) throw new Error("META_APP_SECRET .env'de tanımlı değil");
  return v;
}

/** Meta OAuth izin (consent) ekranı URL'i. */
export function buildAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: getAppId(),
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

/** Authorization code → kısa ömürlü access token. */
async function exchangeCodeForShortToken(code: string, redirectUri: string): Promise<string> {
  const params = new URLSearchParams({
    client_id: getAppId(),
    client_secret: getAppSecret(),
    redirect_uri: redirectUri,
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Meta token değişimi hatası: ${data.error?.message ?? res.status}`);
  }
  return data.access_token;
}

/** Kısa ömürlü token → uzun ömürlü (60 gün) token. */
async function exchangeForLongLivedToken(shortToken: string): Promise<{ token: string; expiresAt: Date }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: getAppId(),
    client_secret: getAppSecret(),
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(`Meta uzun ömürlü token hatası: ${data.error?.message ?? res.status}`);
  }
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 60 * 24 * 60 * 60) * 1000);
  return { token: data.access_token, expiresAt };
}

/** Callback code'unu doğrudan uzun ömürlü token'a çevirir (2 aşama tek fonksiyonda). */
export async function exchangeCodeForLongLivedToken(
  code: string,
  redirectUri: string
): Promise<{ token: string; expiresAt: Date }> {
  const shortToken = await exchangeCodeForShortToken(code, redirectUri);
  return exchangeForLongLivedToken(shortToken);
}

/** Uzun ömürlü token'ı yeniler (süresi dolmadan periyodik çağrılır). */
export async function refreshLongLivedToken(currentToken: string): Promise<{ token: string; expiresAt: Date }> {
  return exchangeForLongLivedToken(currentToken);
}

export interface MetaAdAccount {
  id: string; // "act_XXXXXXXXX"
  name: string;
  business: { id: string; name: string } | null;
}

/** Kullanıcının erişebildiği reklam hesapları. */
export async function getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({
    fields: "id,name,business",
    access_token: accessToken,
  });
  const res = await fetch(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { data?: MetaAdAccount[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Reklam hesapları alınamadı: ${data.error?.message ?? res.status}`);
  return data.data ?? [];
}

/** Reklam kreatifinde kullanılacak Facebook Page ID (kullanıcının yönettiği ilk sayfa). */
export async function getFirstPageId(accessToken: string): Promise<string | null> {
  const params = new URLSearchParams({ fields: "id,name", access_token: accessToken });
  const res = await fetch(`${GRAPH_BASE}/me/accounts?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  if (!res.ok) return null;
  return data.data?.[0]?.id ?? null;
}
