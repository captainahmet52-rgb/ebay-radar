import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/amazon/listings
 * Kullanıcının Amazon listelemeleri (depo ürünü + pazar bilgisiyle).
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const [total, listings] = await Promise.all([
    prisma.amazonListing.count({ where: { userId } }),
    prisma.amazonListing.findMany({
      where: { userId },
      include: {
        product: { select: { title: true, aliId: true, imageUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({ total, listings });
});
