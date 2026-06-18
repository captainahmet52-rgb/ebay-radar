import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { amazonRadarScanQueue } from "@/lib/queues";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

const MARKETS = Object.keys(AMAZON_MARKETS); // us | uk | ae | sa

/**
 * POST /api/admin/amazon/radar
 * Tüm pazarlar için AmazonBot radarını elle tetikler (worker kuyruğuna ekler).
 * Worker radarı çalıştırıp kazananları depoya (AmazonDepotProduct) yazar.
 */
export const POST = requireAdmin(async () => {
  await Promise.all(
    MARKETS.map((market) =>
      amazonRadarScanQueue.add(
        "amazon-radar-scan",
        { market },
        { jobId: `amazon-radar:manual:${market}:${Date.now()}` }
      )
    )
  );

  return NextResponse.json({
    success: true,
    message: `${MARKETS.length} pazar için Amazon radar tarama kuyruğa eklendi`,
  });
});

/**
 * GET /api/admin/amazon/radar
 * Depodaki (kalıcı) Amazon ürünlerini döner — radarın yazdığı sonuçlar.
 */
export const GET = requireAdmin(async () => {
  const [products, total] = await Promise.all([
    prisma.amazonDepotProduct.findMany({
      orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.amazonDepotProduct.count(),
  ]);

  return NextResponse.json({ total, products });
});
