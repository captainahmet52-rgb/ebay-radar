// eBay OAuth 2.0 — Authorization Code flow + Client Credentials grant
import { decryptToken, encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

function isSandbox(): boolean {
  return process.env.EBAY_SANDBOX === "true";
}

function getAuthBaseUrl(): string {
  return isSandbox()
    ? "https://auth.sandbox.ebay.com"
    : "https://auth.ebay.com";
}

function getApiBaseUrl(): string {
  return isSandbox()
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

function getClientId(): string {
  const id = process.env.EBAY_CLIENT_ID;
  if (!id) throw new Error("EBAY_CLIENT_ID .env'de tanımlı değil");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!secret) throw new Error("EBAY_CLIENT_SECRET .env'de tanımlı değil");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.EBAY_REDIRECT_URI;
  if (!uri) throw new Error("EBAY_REDIRECT_URI .env'de tanımlı değil");
  return uri;
}

function getBasicAuth(): string {
  return Buffer.from(`${getClientId()}:${getClientSecret()}`).toString("base64");
}

const SCOPES = [
  // Base scope — Trading API (GetMyeBaySelling ile mevcut ilanları çekmek) için ZORUNLU.
  // Bu scope eklendiğinde, bağlı hesapların YENİDEN onay vermesi gerekir.
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

const APPLICATION_SCOPE = "https://api.ebay.com/oauth/api_scope";

/** Kullanıcıyı eBay OAuth onay sayfasına yönlendirmek için URL üretir */
export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPES,
    state,
  });

  return `${getAuthBaseUrl()}/oauth2/authorize?${params.toString()}`;
}

export interface EbayTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // saniye
  refreshTokenExpiresIn?: number; // saniye — refresh token'ın ömrü
}

/** Authorization code → access + refresh token değişimi */
export async function exchangeCodeForTokens(code: string): Promise<EbayTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });

  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `eBay token değişimi hatası: ${response.status} — ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    refresh_token_expires_in?: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    refreshTokenExpiresIn: data.refresh_token_expires_in,
  };
}

export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string; // eBay refresh token rotate ederse döner
}

/** Şifreli refresh token kullanarak yeni access token al */
export async function refreshAccessToken(
  refreshTokenEncrypted: string
): Promise<RefreshedToken> {
  const refreshToken = decryptToken(refreshTokenEncrypted);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });

  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `eBay token yenileme hatası: ${response.status} — ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
    refreshToken: data.refresh_token,
  };
}

/**
 * Bir EbayAccount için geçerli access token döndürür.
 * tokenExpiresAt 5 dakikadan yakınsa refresh akışını çalıştırır,
 * yeni token + expiry'yi (ve rotate olduysa refresh token'ı) DB'ye yazar.
 * Düz metin access token string olarak döner — log'a yazılmaz.
 */
export async function getValidToken(ebayAccountId: string): Promise<string> {
  const account = await prisma.ebayAccount.findUnique({
    where: { id: ebayAccountId },
  });

  if (!account) {
    throw new Error(`EbayAccount bulunamadı: ${ebayAccountId}`);
  }

  if (!account.oauthTokenEncrypted) {
    throw new Error(`EbayAccount'ta access token yok: ${ebayAccountId}`);
  }

  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  const needsRefresh =
    account.tokenExpiresAt === null ||
    account.tokenExpiresAt.getTime() < fiveMinutesFromNow;

  if (!needsRefresh) {
    return decryptToken(account.oauthTokenEncrypted);
  }

  if (!account.refreshTokenEncrypted) {
    throw new Error(
      `Token yenilenmeli ama refresh token yok: ${ebayAccountId}`
    );
  }

  const refreshed = await refreshAccessToken(account.refreshTokenEncrypted);

  await prisma.ebayAccount.update({
    where: { id: ebayAccountId },
    data: {
      oauthTokenEncrypted: encryptToken(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
      // eBay rotating refresh token döndürdüyse onu da güncelle
      ...(refreshed.refreshToken
        ? { refreshTokenEncrypted: encryptToken(refreshed.refreshToken) }
        : {}),
    },
  });

  return refreshed.accessToken;
}

interface CachedAppToken {
  token: string;
  expiresAt: number; // epoch ms
}

let applicationTokenCache: CachedAppToken | null = null;

/**
 * Client Credentials Grant ile uygulama (app-only) token döndürür.
 * Sonuç expires_in süresince modül-level cache'lenir. Token log'a yazılmaz.
 */
export async function getApplicationToken(): Promise<string> {
  // 60 sn güvenlik tamponu ile cache geçerli mi?
  if (
    applicationTokenCache &&
    applicationTokenCache.expiresAt > Date.now() + 60_000
  ) {
    return applicationTokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: APPLICATION_SCOPE,
  });

  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${getBasicAuth()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `eBay application token hatası: ${response.status} — ${errorBody}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  applicationTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}
