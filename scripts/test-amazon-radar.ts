/**
 * AmazonBot Radar test — örnek adaylarla karar mantığını sınar (API gerekmez).
 * Kullanım: npx tsx scripts/test-amazon-radar.ts [us|uk|ae|sa]
 */

import {
  runRadar,
  DEFAULT_RADAR_CONFIG,
  type AmazonCandidate,
  type RadarConfig,
} from "../src/lib/amazon-radar";
import { AMAZON_MARKETS } from "../src/lib/amazon-repricer";

const SAMPLES: AmazonCandidate[] = [
  {
    aliId: "1001", title: "Mini Taşınabilir Blender USB Şarjlı", aliCost: 6.5, aliShipping: 1.5,
    aliOrders: 4200, aliRating: 4.8, brand: "Generic", category: "kitchen",
    amazonBsr: 8500, amazonSalesEst: 320, amazonSellerCount: 6, amazonSoldByAmazon: false,
  },
  {
    aliId: "1002", title: "Nike Spor Çorap 5'li Paket", aliCost: 4, aliShipping: 0,
    aliOrders: 9000, aliRating: 4.9, brand: "Nike", category: "clothing",
    amazonBsr: 3000, amazonSalesEst: 800, amazonSellerCount: 4, amazonSoldByAmazon: false,
  },
  {
    aliId: "1003", title: "Replica AirPods Pro 1:1 Kablosuz Kulaklık", aliCost: 12, aliShipping: 2,
    aliOrders: 15000, aliRating: 4.7, brand: "Generic", category: "electronics",
    amazonBsr: 1200, amazonSalesEst: 1500, amazonSellerCount: 3, amazonSoldByAmazon: false,
  },
  {
    aliId: "1004", title: "Akıllı Köpek Tasması GPS Takip", aliCost: 22, aliShipping: 3,
    aliOrders: 110, aliRating: 4.6, brand: "Generic", category: "pet",
    amazonBsr: 22000, amazonSalesEst: 90, amazonSellerCount: 9, amazonSoldByAmazon: false,
  },
  {
    aliId: "1005", title: "Ucuz Plastik Telefon Tutucu", aliCost: 1.2, aliShipping: 0,
    aliOrders: 600, aliRating: 4.3, brand: "Generic", category: "electronics",
    amazonBsr: 90000, amazonSalesEst: 15, amazonSellerCount: 40, amazonSoldByAmazon: true,
  },
  {
    aliId: "1006", title: "LED Gece Lambası Mantar Tasarım", aliCost: 5, aliShipping: 1,
    aliOrders: 2800, aliRating: 4.85, brand: "Generic", category: "home",
    amazonBsr: 14000, amazonSalesEst: 210, amazonSellerCount: 7, amazonSoldByAmazon: false,
  },
];

function main() {
  const marketKey = (process.argv[2] ?? "us").toLowerCase();
  const market = AMAZON_MARKETS[marketKey];
  if (!market) {
    console.error(`Geçersiz pazar: ${marketKey}`);
    process.exit(1);
  }
  const config: RadarConfig = { market: marketKey, ...DEFAULT_RADAR_CONFIG };

  console.log(`\n🛰️  AmazonBot Radar — ${market.name}\n${"═".repeat(52)}`);

  const results = runRadar(SAMPLES, config);
  const s = market.symbol;

  for (const { candidate, verdict } of results) {
    const icon = verdict.pass ? "✅" : "❌";
    console.log(`\n${icon} ${candidate.title}`);
    if (verdict.pass && verdict.pricing) {
      console.log(`   Skor: ${verdict.score}/100  |  Satış: ${s}${verdict.pricing.salePrice}  |  Kâr: ${s}${verdict.pricing.netProfit} (%${verdict.pricing.marginPct})`);
    } else {
      console.log(`   Elendi: ${verdict.reasons.join(" · ")}`);
    }
  }

  const passed = results.filter((r) => r.verdict.pass).length;
  console.log(`\n${"═".repeat(52)}`);
  console.log(`Sonuç: ${passed}/${SAMPLES.length} ürün radardan geçti (kazanan).\n`);
}

main();
