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
  // Shopify izi (ABD viral sinyalinden) burada gösterilmez — bu ekran Amazon
  // oto-yükleme/SP-API adayları içindir (2026-07-22 ayrımı).
  const where = { sourceChannel: "amazon" };
  const [total, active, paused, products] = await Promise.all([
    prisma.amazonDepotProduct.count({ where }),
    prisma.amazonDepotProduct.count({ where: { ...where, status: "active" } }),
    prisma.amazonDepotProduct.count({ where: { ...where, status: "paused" } }),
    prisma.amazonDepotProduct.findMany({
      where,
      orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);

  // AliExpress API bağlı değilse depodaki ürünler örnek (demo) veridir
  return NextResponse.json({ demo: !isAliExpressConfigured(), total, active, paused, products });
});
