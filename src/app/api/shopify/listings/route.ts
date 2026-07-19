import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shopify/listings — kullanıcının Shopify listelemeleri
 * (depo ürünü + mağaza bilgisiyle).
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const [total, listings] = await Promise.all([
    prisma.shopifyListing.count({ where: { userId } }),
    prisma.shopifyListing.findMany({
      where: { userId },
      include: {
        product: { select: { title: true, aliId: true, imageUrl: true, aliStockStatus: true } },
        shopifyAccount: { select: { shopDomain: true, metaAccount: { select: { id: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    total,
    listings: listings.map((l) => ({
      ...l,
      shopifyAccount: { shopDomain: l.shopifyAccount.shopDomain, metaConnected: Boolean(l.shopifyAccount.metaAccount) },
    })),
  });
});
