// OAuth `state` CSRF koruması — imzalı, tek-kullanımlık (kısa ömürlü) state üretir.
// state = userId şeklinde ham/forge edilebilir değer KULLANILMAZ.
// HMAC-SHA256 ile imzalanır; timing-safe karşılaştırma + süre kontrolü yapılır.
// Sır: OAUTH_STATE_SECRET varsa o, yoksa NEXTAUTH_SECRET'e düşülür.

import { createHmac, timingSafeEqual } from "crypto";

/** state içinde taşınan veri. region opsiyonel (Amazon SP-API bölge bilgisi için). */
export interface OAuthStatePayload {
  userId: string;
  nonce: string;
  /** Amazon SP-API gibi callback'te bölge gerektiren akışlar için opsiyonel. */
  region?: string;
}

interface SignedPayload extends OAuthStatePayload {
  /** issued-at, epoch ms */
  iat: number;
}

/** state için varsayılan azami yaş — 10 dakika. */
export const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("OAUTH_STATE_SECRET veya NEXTAUTH_SECRET .env'de tanımlı olmalı");
  }
  return secret;
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hmac(data: string): string {
  return base64url(createHmac("sha256", getSecret()).update(data).digest());
}

/**
 * payload'ı imzalar. Çıktı: base64url(JSON) + "." + base64url(hmac)
 * iat (issued-at) otomatik eklenir.
 */
export function signState(payload: OAuthStatePayload): string {
  const signed: SignedPayload = { ...payload, iat: Date.now() };
  const encoded = base64url(Buffer.from(JSON.stringify(signed), "utf8"));
  const sig = hmac(encoded);
  return `${encoded}.${sig}`;
}

/**
 * state'i doğrular: HMAC (timing-safe) + süre kontrolü.
 * Geçersiz/expired ise null döner. Geçerliyse payload döner.
 */
export function verifyState(
  state: string,
  maxAgeMs: number = OAUTH_STATE_MAX_AGE_MS
): OAuthStatePayload | null {
  if (!state || typeof state !== "string") return null;

  const dotIndex = state.lastIndexOf(".");
  if (dotIndex <= 0) return null;

  const encoded = state.slice(0, dotIndex);
  const providedSig = state.slice(dotIndex + 1);
  const expectedSig = hmac(encoded);

  // Timing-safe karşılaştırma — uzunluk farklıysa baştan reddet.
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(providedBuf, expectedBuf)) return null;

  let parsed: SignedPayload;
  try {
    const json = Buffer.from(encoded, "base64").toString("utf8");
    parsed = JSON.parse(json) as SignedPayload;
  } catch {
    return null;
  }

  if (typeof parsed.userId !== "string" || typeof parsed.iat !== "number") {
    return null;
  }

  if (Date.now() - parsed.iat > maxAgeMs) {
    return null;
  }

  return {
    userId: parsed.userId,
    nonce: parsed.nonce,
    ...(parsed.region ? { region: parsed.region } : {}),
  };
}
