import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const STALE_MS = 6 * 60 * 60 * 1000;

/**
 * GET /api/admin/stock-health — stok takibinin sağlık özeti.
 * Toplam/aktif/duraklatılmış ürün, duraklatma sebepleri, tarama yaşı, hata sayacı.
 */
export const GET = requireAdmin(async () => {
  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const freshCutoff = new Date(now - 60 * 60 * 1000); // son 1 saatte taranan

  const [
    total,
    active,
    paused,
    byReason,
    byTier,
    staleActive,
    scrapeFailing,
    freshlyScraped,
    neverScraped,
    listingsActive,
    listingsPaused,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: "active" } }),
    prisma.product.count({ where: { status: "paused" } }),
    prisma.product.groupBy({ by: ["pauseReason"], where: { status: "paused" }, _count: true }),
    prisma.product.groupBy({ by: ["pollTier"], where: { status: "active" }, _count: true }),
    prisma.product.count({ where: { status: "active", lastScrapedAt: { lt: staleCutoff } } }),
    prisma.product.count({ where: { scrapeFailCount: { gt: 0 } } }),
    prisma.product.count({ where: { lastScrapedAt: { gte: freshCutoff } } }),
    prisma.product.count({ where: { lastScrapedAt: null } }),
    prisma.listing.count({ where: { status: "active" } }),
    prisma.listing.count({ where: { status: "paused" } }),
  ]);

  // Son tarama hatası olan örnek ürünler (gözlem için)
  const recentErrors = await prisma.product.findMany({
    where: { scrapeFailCount: { gt: 0 } },
    select: { asin: true, scrapeFailCount: true, lastScrapeError: true, lastScrapedAt: true },
    orderBy: { scrapeFailCount: "desc" },
    take: 15,
  });

  return NextResponse.json({
    products: { total, active, paused, staleActive, scrapeFailing, freshlyScraped, neverScraped },
    listings: { active: listingsActive, paused: listingsPaused },
    pauseReasons: byReason.map((r) => ({ reason: r.pauseReason ?? "—", count: r._count })),
    tiers: byTier.map((t) => ({ tier: t.pollTier, count: t._count })),
    recentErrors,
  });
});
