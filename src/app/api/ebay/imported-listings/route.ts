import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["confirmed", "review", "unmatched", "pending"];
const PAGE_SIZE = 50;

// GET /api/ebay/imported-listings?ebayAccountId=...&status=review&page=1
// İçe aktarılmış ilanları listeler (review kuyruğu / onaylı liste / eşleşmeyenler).
export const GET = requireAuth(async (req, { userId }) => {
  try {
    const url = new URL(req.url);
    const ebayAccountId = url.searchParams.get("ebayAccountId");
    const status = url.searchParams.get("status");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

    const where = {
      userId,
      ...(ebayAccountId ? { ebayAccountId } : {}),
      ...(status && VALID_STATUSES.includes(status) ? { matchStatus: status } : {}),
    };

    const [items, total, counts] = await Promise.all([
      prisma.importedListing.findMany({
        where,
        orderBy: [{ matchConfidence: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          ebayItemId: true,
          ebaySku: true,
          title: true,
          price: true,
          currency: true,
          quantity: true,
          imageUrl: true,
          detectedAsin: true,
          amazonMarket: true,
          matchStatus: true,
          matchConfidence: true,
          matchReason: true,
          trackingEnabled: true,
          createdAt: true,
        },
      }),
      prisma.importedListing.count({ where }),
      // Durum dağılımı (sekme rozetleri için) — sadece mağaza filtresiyle
      prisma.importedListing.groupBy({
        by: ["matchStatus"],
        where: { userId, ...(ebayAccountId ? { ebayAccountId } : {}) },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const c of counts) statusCounts[c.matchStatus] = c._count._all;

    return NextResponse.json({
      data: items,
      meta: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        statusCounts,
      },
    });
  } catch (err) {
    console.error("[ebay/imported-listings GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
