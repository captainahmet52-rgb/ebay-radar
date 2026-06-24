import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { isAliExpressConfigured } from "@/lib/aliexpress";

/**
 * GET /api/amazon/depot
 * Kalıcı AmazonDepotProduct deposu — radarın yazdığı gerçek ürünler + sayımlar.
 *
 * AmazonDepotProduct global/paylaşılan bir admin-curated radar katalogudur
 * (modelde userId yoktur, sadece admin radar worker'ı yazar). Maliyet/BSR/satıcı
 * sayısı gibi iç radar istihbaratını içerir; bu yüzden sadece admin görebilir.
 */
export const GET = requireAdmin(async () => {
  const [total, active, paused, products] = await Promise.all([
    prisma.amazonDepotProduct.count(),
    prisma.amazonDepotProduct.count({ where: { status: "active" } }),
    prisma.amazonDepotProduct.count({ where: { status: "paused" } }),
    prisma.amazonDepotProduct.findMany({
      orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  // AliExpress API bağlı değilse depodaki ürünler örnek (demo) veridir
  return NextResponse.json({ demo: !isAliExpressConfigured(), total, active, paused, products });
});
