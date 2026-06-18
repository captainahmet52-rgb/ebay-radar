/**
 * ADIM 1 (AmazonBot) — Çekirdek motor test script'i
 * AliExpress → Amazon dropshipping fiyat hesaplayıcı.
 * Motor mantığı src/lib/amazon-repricer.ts içinde; bu script onu test eder.
 *
 * Kullanım (elle maliyetle — hemen çalışır, API gerekmez):
 *   npx tsx scripts/test-amazon-repricer.ts --cost 12.50 --market us --category electronics --shipping 2
 *   npx tsx scripts/test-amazon-repricer.ts --cost 8 --market uk --category clothing --margin 0.25
 *
 * AliExpress'ten otomatik çekme (kaynak seçilince aktif olacak):
 *   npx tsx scripts/test-amazon-repricer.ts --ali <urunId> --market us
 *
 * NOT (politika riski — bilinçli kabul): Amazon, başka perakendecinin (AliExpress)
 * ambalaj/fişiyle gönderimi yasaklar; markalı/kısıtlı ürün yüklemesi hesap riski taşır.
 * Marka/yasak filtresi ve getListingsRestrictions kontrolü radar/listeleme adımında eklenecek.
 */

import * as dotenv from "dotenv";
import {
  AMAZON_MARKETS,
  getReferralRate,
  calculateAmazonPrice,
  determineAmazonQty,
  DEFAULT_MARGIN,
  type AliStockStatus,
} from "../src/lib/amazon-repricer";

dotenv.config();

// ─── AliExpress veri çekme (entegrasyon noktası) ─────────────────────────────
// Kaynak seçilince doldurulacak: (A) AliExpress Open Platform Dropshipper API
// veya (B) Apify scraper. Şimdilik elle --cost modu kullanılır.

interface AliProduct {
  cost: number;
  shipping: number;
  stock: AliStockStatus;
  title?: string;
}

async function fetchAliExpressProduct(_id: string): Promise<AliProduct> {
  throw new Error(
    "AliExpress veri kaynağı henüz seçilmedi.\n" +
    "  Seçenekler: (A) AliExpress Open Platform Dropshipper API  (B) Apify scraper.\n" +
    "  Şimdilik elle test: --cost <fiyat> --market <us|uk|ae|sa>"
  );
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const marketKey = (getArg("market") ?? "us").toLowerCase();
  const market = AMAZON_MARKETS[marketKey];
  if (!market) {
    console.error(`Geçersiz pazar: ${marketKey}. Seçenekler: ${Object.keys(AMAZON_MARKETS).join(", ")}`);
    process.exit(1);
  }

  const categoryKey = getArg("category");
  const referralRate = getReferralRate(categoryKey);
  const margin = parseFloat(getArg("margin") ?? String(DEFAULT_MARGIN));
  const shipping = parseFloat(getArg("shipping") ?? "0");

  let cost: number;
  let stock: AliStockStatus = "in_stock";
  let title: string | undefined;

  const aliId = getArg("ali");
  const costArg = getArg("cost");

  if (aliId) {
    try {
      const p = await fetchAliExpressProduct(aliId);
      cost = p.cost;
      stock = p.stock;
      title = p.title;
    } catch (err) {
      console.error("Hata:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  } else if (costArg) {
    cost = parseFloat(costArg);
  } else {
    console.error("Kullanım: npx tsx scripts/test-amazon-repricer.ts --cost <fiyat> --market <us|uk|ae|sa> [--shipping n] [--category electronics] [--margin 0.20]");
    process.exit(1);
  }

  if (isNaN(cost!) || cost! <= 0) {
    console.error("Geçersiz maliyet.");
    process.exit(1);
  }

  const r = calculateAmazonPrice(cost!, shipping, referralRate, market.minReferral, margin);
  const qty = determineAmazonQty(stock, null);
  const s = market.symbol;

  console.log("═".repeat(48));
  console.log(`  Pazar             : ${market.name} (${market.currency})`);
  if (title) console.log(`  Ürün              : ${title}`);
  console.log(`  AliExpress maliyet : ${s}${cost!.toFixed(2)}`);
  console.log(`  Kargo             : ${s}${shipping.toFixed(2)}`);
  console.log(`  Kategori          : ${categoryKey ?? "default"} (komisyon %${(referralRate * 100).toFixed(0)})`);
  console.log(`  Hedef marj        : %${(margin * 100).toFixed(0)}`);
  console.log("  " + "─".repeat(44));
  console.log(`  Amazon satış fiyatı: ${s}${r.salePrice.toFixed(2)}`);
  console.log(`  Amazon komisyon    : ${s}${r.referralFee.toFixed(2)}`);
  console.log(`  Net kâr            : ${s}${r.netProfit.toFixed(2)}  (%${r.marginPct})`);
  if (aliId) console.log(`  Önerilen Amazon Q  : ${qty}`);
  console.log("═".repeat(48));
}

main();
