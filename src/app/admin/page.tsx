import { prisma } from "@/lib/prisma";
import { AdminCharts } from "./_components/AdminCharts";

export const dynamic = "force-dynamic";

interface MonthRow { month: string; month_date: Date; count: number }
interface OrderRow { month: string; month_date: Date; count: number; revenue: number }

function fmt(n: number | null | undefined): string {
  if (!n) return "0";
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default async function AdminPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers, usersThisMonth,
    activeListings, pausedListings,
    totalOrders, ordersThisMonth,
    revenueAgg, profitAgg,
    planGroups,
    depotCount, distributionCount,
    rawMonthlyUsers, rawMonthlyOrders,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.listing.count({ where: { status: "paused" } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.order.aggregate({ _sum: { soldPrice: true } }),
    prisma.order.aggregate({ _sum: { netProfit: true } }),
    prisma.user.groupBy({ by: ["plan"], _count: { _all: true }, orderBy: { _count: { plan: "desc" } } }),
    prisma.depotProduct.count(),
    prisma.productDistribution.count(),
    prisma.$queryRaw<MonthRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
        DATE_TRUNC('month', "createdAt") AS month_date,
        COUNT(*)::int AS count
      FROM "User"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month_date ASC
    `,
    prisma.$queryRaw<OrderRow[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
        DATE_TRUNC('month', "createdAt") AS month_date,
        COUNT(*)::int AS count,
        COALESCE(SUM("soldPrice"), 0)::float AS revenue
      FROM "Order"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month_date ASC
    `,
  ]);

  const totalRevenue = revenueAgg._sum.soldPrice ?? 0;
  const totalProfit  = profitAgg._sum.netProfit ?? 0;

  const planCounts = planGroups.map(g => ({ plan: g.plan, count: g._count._all }));

  const monthlyUsers  = rawMonthlyUsers.map(r => ({ month: r.month, count: Number(r.count) }));
  const monthlyOrders = rawMonthlyOrders.map(r => ({ month: r.month, count: Number(r.count), revenue: Number(r.revenue) }));

  const statCards = [
    { label: "Toplam Kullanıcı",    value: fmt(totalUsers),        sub: `+${usersThisMonth} bu ay`,     color: "#7c3aed" },
    { label: "Aktif Listing",       value: fmt(activeListings),    sub: `${pausedListings} duraklatılmış`, color: "#2563eb" },
    { label: "Toplam Sipariş",      value: fmt(totalOrders),       sub: `${ordersThisMonth} bu ay`,      color: "#0891b2" },
    { label: "Tahmini Gelir",       value: `$${totalRevenue.toFixed(0)}`, sub: "Tüm zamanlar",           color: "#059669" },
    { label: "Tahmini Net Kâr",     value: `$${totalProfit.toFixed(0)}`,  sub: "Tüm zamanlar",           color: "#16a34a" },
    { label: "Depodaki Ürün",       value: fmt(depotCount),        sub: `${distributionCount} dağıtım`, color: "#d97706" },
  ];

  return (
    <div style={{ color: "#f0f6fc", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Analytics Dashboard</h1>
        <span style={{ fontSize: "0.8rem", color: "#8b949e" }}>
          {now.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </div>

      {/* Stat kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1rem" }}>
            <p style={{ fontSize: "0.72rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: "0.75rem", color: "#8b949e", marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Grafikler */}
      <div style={{ marginBottom: "1.25rem" }}>
        <AdminCharts monthlyUsers={monthlyUsers} monthlyOrders={monthlyOrders} planCounts={planCounts} />
      </div>

      {/* Alt bilgi + hızlı işlemler */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* Sistem istatistikleri */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.25rem" }}>
          <p style={{ color: "#8b949e", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "1rem" }}>Sistem</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "Dağıtılan Ürün",     value: distributionCount },
              { label: "Toplam Listing",      value: activeListings + pausedListings },
              { label: "Aktif Kullanıcı",     value: totalUsers },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #21262d" }}>
                <span style={{ fontSize: "0.85rem", color: "#8b949e" }}>{r.label}</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f0f6fc" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
