import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const DAYS_WINDOW = 30;

/** Bir tarihi "dd.mm" (tr-TR) etiketine çevirir — grafik ekseni için. */
function dayLabel(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - (DAYS_WINDOW - 1));
    windowStart.setHours(0, 0, 0, 0);

    const [
      totalProfitResult,
      totalOrders,
      fulfilledCount,
      verifiedOrFulfilledCount,
      activeListings,
      pendingOrders,
      thisMonthProfitResult,
      lastMonthProfitResult,
      windowOrders,
      recentOrdersRaw,
    ] = await Promise.all([
      // Toplam kâr (fulfilled siparişler)
      prisma.order.aggregate({
        where: { userId, fulfillmentStatus: "fulfilled" },
        _sum: { netProfit: true },
      }),
      // Toplam sipariş sayısı
      prisma.order.count({ where: { userId } }),
      // Tamamlanan (fulfilled) sipariş sayısı — ort. kâr/sipariş için
      prisma.order.count({ where: { userId, fulfillmentStatus: "fulfilled" } }),
      // Doğrulanmış + tamamlanmış (başarı oranı için)
      prisma.order.count({
        where: { userId, fulfillmentStatus: { in: ["verified", "fulfilled"] } },
      }),
      // Aktif listing sayısı (gerçek "Aktif Listeler")
      prisma.listing.count({ where: { userId, status: "active" } }),
      // Bekleyen sipariş sayısı
      prisma.order.count({ where: { userId, fulfillmentStatus: "pending" } }),
      // Bu ay kâr
      prisma.order.aggregate({
        where: { userId, fulfillmentStatus: "fulfilled", createdAt: { gte: startOfMonth } },
        _sum: { netProfit: true },
      }),
      // Geçen ay kâr (bu ay değişim yüzdesi için)
      prisma.order.aggregate({
        where: {
          userId,
          fulfillmentStatus: "fulfilled",
          createdAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
        _sum: { netProfit: true },
      }),
      // Son 30 günün fulfilled siparişleri — günlük kâr grafiği için
      prisma.order.findMany({
        where: { userId, fulfillmentStatus: "fulfilled", createdAt: { gte: windowStart } },
        select: { netProfit: true, createdAt: true },
      }),
      // Son 5 sipariş — "Son Siparişler" listesi için
      prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          ebayOrderId: true,
          soldPrice: true,
          netProfit: true,
          fulfillmentStatus: true,
          createdAt: true,
          listing: { select: { product: { select: { asin: true } } } },
        },
      }),
    ]);

    const totalProfit = totalProfitResult._sum.netProfit ?? 0;
    const thisMonthProfit = thisMonthProfitResult._sum.netProfit ?? 0;
    const lastMonthProfit = lastMonthProfitResult._sum.netProfit ?? 0;

    const successRate =
      totalOrders > 0
        ? Math.round((verifiedOrFulfilledCount / totalOrders) * 10000) / 100
        : 0;

    const avgProfitPerOrder =
      fulfilledCount > 0 ? Math.round((totalProfit / fulfilledCount) * 100) / 100 : 0;

    // Bu ay vs geçen ay kâr değişimi (geçen ay 0 ise değişim gösterme)
    const thisMonthChange =
      lastMonthProfit > 0
        ? Math.round(((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 1000) / 10
        : null;

    // 30 günlük günlük kâr serisi — her gün 0'dan başlar, siparişler eklenir
    const buckets = new Map<string, { date: string; profit: number }>();
    for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { date: dayLabel(d), profit: 0 });
    }
    for (const o of windowOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (b) b.profit += o.netProfit ?? 0;
    }
    const dailyProfit = Array.from(buckets.values()).map((b) => ({
      date: b.date,
      profit: Math.round(b.profit * 100) / 100,
    }));

    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o.ebayOrderId ?? o.id.slice(0, 8),
      asin: o.listing?.product?.asin ?? "—",
      salePrice: o.soldPrice ?? 0,
      netProfit: o.netProfit ?? 0,
      status: o.fulfillmentStatus,
      date: o.createdAt.toLocaleDateString("tr-TR"),
    }));

    return NextResponse.json({
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalOrders,
      activeListings,
      pendingOrders,
      successRate, // yüzde, örn: 87.50
      thisMonthProfit: Math.round(thisMonthProfit * 100) / 100,
      thisMonthChange, // yüzde değişim ya da null
      avgProfitPerOrder,
      dailyProfit,
      recentOrders,
    });
  } catch (err) {
    console.error("[orders/stats GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
