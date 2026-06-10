#!/usr/bin/env npx tsx
/**
 * eBay Otomasyon SaaS — Güvenli Anahtar Üretici
 *
 * Kullanım:
 *   npx tsx scripts/generate-keys.ts
 *
 * Üretilen anahtarlar:
 *   NEXTAUTH_SECRET       — 32 byte, base64url  (NextAuth imzalama)
 *   TOKEN_ENCRYPTION_KEY  — 32 byte, hex (64 kar) (eBay OAuth token şifreleme)
 *   CRON_SECRET           — 24 byte, hex (48 kar) (cron endpoint koruması)
 */

import { randomBytes } from "crypto"

function generateBase64(bytes: number): string {
  return randomBytes(bytes)
    .toString("base64url")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .substring(0, Math.ceil(bytes * 4 / 3))
}

function generateHex(bytes: number): string {
  return randomBytes(bytes).toString("hex")
}

const nextauthSecret = generateBase64(32)
const tokenEncryptionKey = generateHex(32)   // 64 karakter hex = 256-bit AES key
const cronSecret = generateHex(24)           // 48 karakter hex

console.log("\n╔══════════════════════════════════════════════════════════════╗")
console.log("║         eBay SaaS — Üretilen Güvenli Anahtarlar             ║")
console.log("╚══════════════════════════════════════════════════════════════╝\n")

console.log("# Aşağıdaki satırları .env dosyanıza yapıştırın:\n")
console.log(`NEXTAUTH_SECRET="${nextauthSecret}"`)
console.log(`TOKEN_ENCRYPTION_KEY="${tokenEncryptionKey}"`)
console.log(`CRON_SECRET="${cronSecret}"`)

console.log("\n──────────────────────────────────────────────────────────────")
console.log("Anahtar bilgileri:")
console.log(`  NEXTAUTH_SECRET       : ${nextauthSecret.length} karakter (base64url, 32 byte entropi)`)
console.log(`  TOKEN_ENCRYPTION_KEY  : ${tokenEncryptionKey.length} karakter (hex, 256-bit AES için)`)
console.log(`  CRON_SECRET           : ${cronSecret.length} karakter (hex, 192-bit entropi)`)
console.log("──────────────────────────────────────────────────────────────")
console.log("\n⚠  Bu anahtarları güvenli bir yerde saklayın.")
console.log("   .env dosyasını asla git'e commit etmeyin!\n")
