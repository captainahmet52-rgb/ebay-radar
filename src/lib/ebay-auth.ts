// eBay OAuth 2.0 — Authorization Code flow
import { decryptToken } from "@/lib/crypto";

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

const SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

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
}

/** Authorization code → access + refresh token değişimi */
export async function exchangeCodeForTokens(code: string): Promise<EbayTokens> {
  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });

  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
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
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
}

/** Şifreli refresh token kullanarak yeni access token al */
export async function refreshAccessToken(
  refreshTokenEncrypted: string
): Promise<RefreshedToken> {
  const refreshToken = decryptToken(refreshTokenEncrypted);

  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });

  const response = await fetch(`${getApiBaseUrl()}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
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
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}
