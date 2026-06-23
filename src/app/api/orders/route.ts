import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;
    const fulfillmentStatus = searchParams.get("fulfillmentStatus");
    const ebayAccountId = searchParams.get("ebayAccountId");

    const where: Record<string, unknown> = { userId };
    if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
    // Mağazaya göre filtre (sipariş → listing → ebayAccount)
    if (ebayAccountId) where.listing = { ebayAccountId };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          listing: {
            include: {
              product: {
                select: {
                  asin: true,
                  title: true,
                  imageUrl: true,
                },
              },
              ebayAccount: {
                select: { id: true, ebayUserId: true, marketplace: true },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({
      data: orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[orders GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
