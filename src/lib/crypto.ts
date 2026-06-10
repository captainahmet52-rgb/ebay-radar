// Token şifreleme — Node.js yerleşik crypto (AES-256-GCM)
// Python Fernet KULLANILMAZ. CLAUDE.md Bölüm 0.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_HEX   = process.env.TOKEN_ENCRYPTION_KEY ?? "";

function getKey(): Buffer {
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY .env'de 64 hex karakter olmalı (32 byte)");
  }
  return Buffer.from(KEY_HEX, "hex");
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv  = randomBytes(12); // 96-bit IV for GCM

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: iv(hex) + ":" + tag(hex) + ":" + ciphertext(hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = encrypted.split(":");

  if (!ivHex || !tagHex || !dataHex) throw new Error("Geçersiz şifreli token formatı");

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
