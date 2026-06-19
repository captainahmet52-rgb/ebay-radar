import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/amazon/depot
 * Kalıcı AmazonDepotProduct deposu — radarın yazdığı gerçek ürünler + sayımlar.
 */
export const GET = requireAuth(async () => {
  const [total, active, paused, products] = await Promise.all([
    prisma.amazonDepotProduct.count(),
    prisma.amazonDepotProduct.count({ where: { status: "active" } }),
    prisma.amazonDepotProduct.count({ where: { status: "paused" } }),
    prisma.amazonDepotProduct.findMany({
      orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  return NextResponse.json({ total, active, paused, products });
});
