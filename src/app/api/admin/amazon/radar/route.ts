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
 * Depodaki (kalıcı) Amazon ürünleri + tüm sistemin Amazon istatistikleri.
 */
export const GET = requireAdmin(async () => {
  const [products, depotTotal, depotActive, depotPaused, accounts, listings, orders, riskOrders] =
    await Promise.all([
      prisma.amazonDepotProduct.findMany({
        orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      prisma.amazonDepotProduct.count(),
      prisma.amazonDepotProduct.count({ where: { status: "active" } }),
      prisma.amazonDepotProduct.count({ where: { status: "paused" } }),
      prisma.amazonAccount.count(),
      prisma.amazonListing.count(),
      prisma.amazonOrder.count(),
      prisma.amazonOrder.count({ where: { status: "risk" } }),
    ]);

  return NextResponse.json({
    stats: { depotTotal, depotActive, depotPaused, accounts, listings, orders, riskOrders },
    products,
  });
});
