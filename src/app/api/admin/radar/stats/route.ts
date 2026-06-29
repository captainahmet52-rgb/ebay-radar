// Admin radar zekâ paneli verisi — depo dağılımı, mağaza rollup, son kararlar (audit),
// oto-pilot durumu. Salt-okunur.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getRadarRedis } from "@/lib/radar/redis-client";
import { readRecentDecisions } from "@/lib/radar/audit";
import { isStoreDue } from "@/lib/radar/schedule";

export const GET = requireAdmin(async () => {
  const [statusGroups, storeStatusGroups, stores, topProducts] = await Promise.all([
    // Depo durum dağılımı (active/review/rejected)
    prisma.depotProduct.groupBy({ by: ["status"], _count: { _all: true } }),
    // Mağaza × durum kırılımı
    prisma.depotProduct.groupBy({ by: ["sourceStoreId", "status"], _count: { _all: true } }),
    // Takip edilen mağazalar
    prisma.trackedStore.findMany({ orderBy: { createdAt: "desc" } }),
    // En yüksek rankScore'lu aktif depo ürünleri (kâr × talep × rekabetçilik)
    prisma.depotProduct.findMany({
      where: { status: "active" },
      orderBy: { rankScore: "desc" },
      take: 15,
      select: {
        asin: true, title: true, amazonPrice: true, calculatedEbayPrice: true,
        soldCount: true, projectedProfit: true, rankScore: true,
      },
    }),
  ]);

  // Depo durum sayıları
  const depotByStatus: Record<string, number> = {};
  for (const g of statusGroups) depotByStatus[g.status] = g._count._all;

  // Mağaza başına durum sayıları
  const perStoreStatus: Record<string, Record<string, number>> = {};
  for (const g of storeStatusGroups) {
    const key = g.sourceStoreId ?? "unknown";
    (perStoreStatus[key] ??= {})[g.status] = g._count._all;
  }

  const now = new Date();
  const storeRows = stores.map((s) => ({
    id: s.id,
    ebayUsername: s.ebayUsername,
    isActive: s.isActive,
    scanIntervalHours: s.scanIntervalHours,
    lastScannedAt: s.lastScannedAt,
    due: isStoreDue({ scanIntervalHours: s.scanIntervalHours, lastScannedAt: s.lastScannedAt }, now),
    counts: perStoreStatus[s.id] ?? {},
  }));

  // Son kararlar (audit) — Redis varsa
  const redis = getRadarRedis();
  const recentDecisions = redis ? await readRecentDecisions(redis, 60) : [];

  // Audit'ten karar dağılımı (son pencere)
  const decisionDist: Record<string, number> = {};
  for (const d of recentDecisions) decisionDist[d.decision] = (decisionDist[d.decision] ?? 0) + 1;

  return NextResponse.json({
    depotByStatus,
    stores: storeRows,
    topProducts,
    recentDecisions: recentDecisions.slice(0, 40),
    decisionDist,
    autopilot: {
      dueNow: storeRows.filter((s) => s.isActive && s.due).length,
      activeStores: storeRows.filter((s) => s.isActive).length,
    },
  });
});
