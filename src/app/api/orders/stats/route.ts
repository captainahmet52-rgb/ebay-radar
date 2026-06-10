import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalProfitResult,
      totalOrders,
      verifiedOrFulfilledCount,
      thisMonthProfitResult,
    ] = await Promise.all([
      // Toplam kâr (fulfilled siparişler)
      prisma.order.aggregate({
        where: { userId, fulfillmentStatus: "fulfilled" },
        _sum: { netProfit: true },
      }),

      // Toplam sipariş sayısı
      prisma.order.count({ where: { userId } }),

      // Doğrulanmış + tamamlanmış sipariş sayısı (başarı oranı için)
      prisma.order.count({
        where: {
          userId,
          fulfillmentStatus: { in: ["verified", "fulfilled"] },
        },
      }),

      // Bu ay kâr
      prisma.order.aggregate({
        where: {
          userId,
          fulfillmentStatus: "fulfilled",
          createdAt: { gte: startOfMonth },
        },
        _sum: { netProfit: true },
      }),
    ]);

    const totalProfit = totalProfitResult._sum.netProfit ?? 0;
    const thisMonthProfit = thisMonthProfitResult._sum.netProfit ?? 0;
    const successRate =
      totalOrders > 0
        ? Math.round((verifiedOrFulfilledCount / totalOrders) * 10000) / 100
        : 0;

    return NextResponse.json({
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalOrders,
      successRate, // yüzde olarak, örn: 87.50
      thisMonthProfit: Math.round(thisMonthProfit * 100) / 100,
    });
  } catch (err) {
    console.error("[orders/stats GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
