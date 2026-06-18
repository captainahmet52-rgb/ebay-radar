import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runRadar, buildRadarConfig } from "@/lib/amazon-radar";
import { SAMPLE_CANDIDATES } from "@/lib/amazon-radar-samples";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

/**
 * GET /api/amazon/radar?market=us
 * Radarı çalıştırıp kazanan/elenen ürünleri döner.
 * NOT: Şu an örnek adaylar (demo). AliExpress API + Keepa bağlanınca canlı veriyle çalışacak.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const market = (searchParams.get("market") ?? "us").toLowerCase();
  if (!AMAZON_MARKETS[market]) {
    return NextResponse.json({ error: `Geçersiz pazar: ${market}` }, { status: 400 });
  }

  // Pazar başına marj + KDV/gümrük/kur otomatik (buildRadarConfig)
  const config = buildRadarConfig(market);
  const results = runRadar(SAMPLE_CANDIDATES, config);

  return NextResponse.json({
    market,
    demo: true, // gerçek kaynak bağlanınca false olacak
    targetMargin: config.targetMargin,
    total: results.length,
    passed: results.filter((r) => r.verdict.pass).length,
    results,
  });
}
