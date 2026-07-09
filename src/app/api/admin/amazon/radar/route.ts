import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/admin/amazon/radar
 * NOT: AmazonBot radarı (keşif/skorlama) artık Radar projesinde (urun-radari) kendi
 * takviminde otomatik çalışıp kazananları /api/amazon-depot/intake'e yolluyor —
 * bu projeden elle tetiklenmez. (İleride Radar'a bir "şimdi tara" ucu eklenebilir.)
 */
export const POST = requireAdmin(async () => {
  return NextResponse.json({
    success: true,
    message:
      "AmazonBot radarı artık Radar projesinde otomatik çalışıyor; ürünler depoya otomatik düşer.",
  });
});

/**
 * GET /api/admin/amazon/radar
 * Depodaki (kalıcı) Amazon ürünleri + tüm sistemin Amazon istatistikleri.
 */
export const GET = requireAdmin(async () => {
  const [products, uploaded, depotTotal, depotActive, depotPaused, accounts, listings, orders, riskOrders] =
    await Promise.all([
      prisma.amazonDepotProduct.findMany({
        orderBy: [{ radarScore: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
      // Depodan YÜKLENEN ürünler (tüm kullanıcılar) — hangi ürün, hangi pazar, kim, durum
      prisma.amazonListing.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          product: { select: { title: true, aliId: true } },
          user: { select: { email: true } },
        },
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
    uploaded,
  });
});
