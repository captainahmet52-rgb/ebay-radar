/**
 * ADIM 1 — Çekirdek motor
 * Kullanım: npx tsx scripts/test-repricer.ts <ASIN>
 *
 * Sadece şu işi yapar:
 *   1. ScrapingBee API → Amazon fiyat + stok çek
 *   2. Repricer formülü uygula
 *   3. Konsola yazdır
 *
 * Veritabanı yok, Next.js yok, başka hiçbir şey yok.
 */

import * as dotenv from "dotenv";
dotenv.config();

// ─── Sabitler ────────────────────────────────────────────────────────────────

const SCRAPINGBEE_KEY = process.env.SCRAPINGBEE_API_KEY;
const DEFAULT_COMMISSION = 0.136;
const TARGET_MARGIN = 0.20;

// ─── Repricer formülü (CLAUDE.md Bölüm 3) ────────────────────────────────────

function calculateEbayPrice(
  amazonPrice: number,
  commission = DEFAULT_COMMISSION,
  margin = TARGET_MARGIN
) {
  const fixedFee = amazonPrice >= 10 ? 0.40 : 0.30;
  const ebayPrice = (amazonPrice + fixedFee) / (1 - commission - margin);
  const ebayFee   = ebayPrice * commission + fixedFee;
  const netProfit = ebayPrice - amazonPrice - ebayFee;
  const marginPct = (netProfit / ebayPrice) * 100;

  return {
    ebayPrice:  Math.round(ebayPrice  * 100) / 100,
    ebayFee:    Math.round(ebayFee    * 100) / 100,
    netProfit:  Math.round(netProfit  * 100) / 100,
    marginPct:  Math.round(marginPct  * 10)  / 10,
  };
}

// ─── ScrapingBee ile Amazon veri çekme ───────────────────────────────────────

async function fetchAmazon(asin: string) {
  if (!SCRAPINGBEE_KEY) {
    throw new Error("SCRAPINGBEE_API_KEY .env dosyasında bulunamadı.");
  }

  const extractRules = JSON.stringify({
    price_apex:      ".apexPriceToPay .a-offscreen",
    price_buybox:    "#corePrice_feature_div .a-price .a-offscreen",
    price_whole:     ".a-price-whole",
    price_fraction:  ".a-price-fraction",
    availability:    "#availability span",
    title:           "#productTitle",
  });

  const params = new URLSearchParams({
    api_key:        SCRAPINGBEE_KEY,
    url:            `https://www.amazon.com/dp/${asin}`,
    render_js:      "true",
    country_code:   "us",
    extract_rules:  extractRules,
  });

  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`);
  if (!res.ok) throw new Error(`ScrapingBee HTTP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function parsePrice(data: Record<string, unknown>): number | null {
  // Öncelik sırası: apex buy-box → corePrice container → whole+fraction
  for (const key of ["price_apex", "price_buybox"]) {
    const raw = String(Array.isArray(data[key]) ? (data[key] as string[])[0] : (data[key] ?? ""))
      .replace(/[^0-9.]/g, "").trim();
    const parsed = parseFloat(raw);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Yedek: whole + fraction
  const whole = String(data["price_whole"] ?? "").replace(",", "").trim().replace(/\.$/, "");
  const frac  = String(data["price_fraction"] ?? "00").trim();
  const fallback = parseFloat(`${whole}.${frac}`);
  return isNaN(fallback) ? null : fallback;
}

function parseStock(data: Record<string, unknown>): {
  status: "in_stock" | "low" | "out";
  qty: number | null;
} {
  const text = String(data["availability"] ?? "").toLowerCase().trim();

  if (!text || text.includes("unavailable") || text.includes("out of stock")) {
    return { status: "out", qty: null };
  }

  const match = text.match(/only\s+(\d+)\s+left/);
  if (match) {
    return { status: "low", qty: parseInt(match[1], 10) };
  }

  if (text.includes("in stock") || text.includes("available")) {
    return { status: "in_stock", qty: null };
  }

  return { status: "out", qty: null };
}

// ─── Stok kuralı (CLAUDE.md Bölüm 4) ─────────────────────────────────────────

function recommendedQty(status: "in_stock" | "low" | "out", qty: number | null): number {
  if (status === "in_stock") return 2;
  if (status === "low" && (qty ?? 0) >= 3) return 1;
  return 0; // low(1-2) veya out → duraklat
}

// ─── Ana akış ─────────────────────────────────────────────────────────────────

async function main() {
  const asin = process.argv[2]?.trim().toUpperCase();
  if (!asin) {
    console.error("Kullanım: npx tsx scripts/test-repricer.ts <ASIN>");
    process.exit(1);
  }

  console.log(`\nASIN: ${asin} sorgulanıyor...\n`);

  let data: Record<string, unknown>;
  try {
    data = await fetchAmazon(asin);
  } catch (err) {
    console.error("Hata:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const amazonPrice = parsePrice(data);
  if (amazonPrice === null) {
    console.error("Amazon fiyatı okunamadı. Ham veri:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const { status, qty } = parseStock(data);
  const pricing  = calculateEbayPrice(amazonPrice);
  const ebayQty  = recommendedQty(status, qty);

  const stockLabel =
    status === "in_stock" ? "Bol stokta" :
    status === "low"      ? `Az kaldı (${qty ?? "?"} adet)` :
                            "Stok yok";

  console.log("═".repeat(44));
  console.log(`  Amazon fiyatı   : $${amazonPrice.toFixed(2)}`);
  console.log(`  eBay satış fiy. : $${pricing.ebayPrice.toFixed(2)}`);
  console.log(`  eBay komisyon   : $${pricing.ebayFee.toFixed(2)}`);
  console.log(`  Net kâr         : $${pricing.netProfit.toFixed(2)}  (${pricing.marginPct}%)`);
  console.log(`  Amazon stok     : ${stockLabel}`);
  console.log(`  Önerilen eBay Q : ${ebayQty}`);
  console.log("═".repeat(44));
}

main();
