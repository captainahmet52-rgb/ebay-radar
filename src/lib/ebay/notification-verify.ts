// eBay Notification API imza doğrulaması (ECDSA).
//
// eBay, bildirimleri `x-ebay-signature` header'ı ile imzalar. Header, Base64 ile
// kodlanmış bir JSON'dur: { "alg": "ecdsa", "kid": "<public key id>", "signature":
// "<base64 imza>", "digest": "SHA1" }. Doğrulama akışı:
//   1. Header'ı decode et → kid + signature çıkar.
//   2. Public key'i eBay'den çek: GET /commerce/notification/v1/public_key/{kid}
//      (app token — client credentials — gerekir). Anahtar uzun ömürlü → cache'lenir.
//   3. HAM istek gövdesi üzerinde ECDSA-SHA1 imzayı doğrula.
//
// Kaynak: eBay event-notification SDK'ları + Notification API dokümantasyonu.
// NOT: gövde, JSON.parse edilmeden ÖNCEKİ ham string olmalı (yeniden serialize
// edilirse alan sırası/boşluk değişir ve imza tutmaz).

import { createVerify } from "crypto";
import { getApplicationToken } from "./oauth";

interface EbaySignatureHeader {
  alg?: string;
  kid?: string;
  signature?: string;
  digest?: string;
}

function getApiBaseUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

// Public key cache — anahtarlar uzun ömürlü, 24 saat yeterli.
const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const keyCache = new Map<string, { pem: string; fetchedAt: number }>();

/** eBay'in verdiği tek-satır PEM'i Node crypto'nun beklediği çok-satırlı forma çevirir. */
function normalizePem(rawKey: string): string {
  const base64 = rawKey
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s+/g, "");
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
}

async function fetchPublicKey(kid: string): Promise<string | null> {
  const cached = keyCache.get(kid);
  if (cached && Date.now() - cached.fetchedAt < KEY_CACHE_TTL_MS) {
    return cached.pem;
  }

  try {
    const token = await getApplicationToken();
    const res = await fetch(
      `${getApiBaseUrl()}/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      console.error(`[ebay-notification-verify] public key alınamadı: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { key?: string };
    if (!data.key) return null;

    const pem = normalizePem(data.key);
    keyCache.set(kid, { pem, fetchedAt: Date.now() });
    return pem;
  } catch (err) {
    console.error(
      "[ebay-notification-verify] public key hatası:",
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

/**
 * eBay bildirim imzasını doğrular. `rawBody` = HAM istek gövdesi (req.text()).
 * Header decode edilemezse, anahtar çekilemezse veya imza tutmazsa false döner —
 * asla throw etmez (webhook handler'ları güvenle çağırabilir).
 */
export async function verifyEbayNotificationSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !rawBody) return false;

  let parsed: EbaySignatureHeader;
  try {
    parsed = JSON.parse(
      Buffer.from(signatureHeader, "base64").toString("utf8")
    ) as EbaySignatureHeader;
  } catch {
    return false; // Base64-JSON değil — eBay imza formatı değil
  }
  if (!parsed.kid || !parsed.signature) return false;

  const pem = await fetchPublicKey(parsed.kid);
  if (!pem) return false;

  try {
    const verifier = createVerify(parsed.digest === "SHA256" ? "sha256" : "sha1");
    verifier.update(rawBody);
    return verifier.verify(pem, parsed.signature, "base64");
  } catch {
    return false;
  }
}

/** Header'ın eBay imza formatında (Base64-JSON) olup olmadığını hızlıca söyler. */
export function looksLikeEbaySignature(signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  try {
    const parsed = JSON.parse(
      Buffer.from(signatureHeader, "base64").toString("utf8")
    ) as EbaySignatureHeader;
    return Boolean(parsed.kid && parsed.signature);
  } catch {
    return false;
  }
}
