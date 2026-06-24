import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getScraperUsage } from "@/lib/scraper";

const STALE_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

  // Son 24 saat aktivitesi
  const since24h = new Date(now - DAY_MS);
  const [snapshots24h, recoveries24h] = await Promise.all([
    prisma.stockSnapshot.count({ where: { createdAt: { gte: since24h } } }),
    prisma.stockSnapshot.count({ where: { createdAt: { gte: since24h }, source: "recovery" } }),
  ]);

  // Scraper kotası (best-effort — okunamazsa null)
  let scraper: { used: number; max: number; pct: number } | null = null;
  try {
    scraper = await getScraperUsage();
  } catch {
    scraper = null;
  }

  return NextResponse.json({
    products: { total, active, paused, staleActive, scrapeFailing, freshlyScraped, neverScraped },
    listings: { active: listingsActive, paused: listingsPaused },
    pauseReasons: byReason.map((r) => ({ reason: r.pauseReason ?? "—", count: r._count })),
    tiers: byTier.map((t) => ({ tier: t.pollTier, count: t._count })),
    activity: { snapshots24h, recoveries24h },
    scraper,
    recentErrors,
  });
});
