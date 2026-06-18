import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { TRACKING_CONVERSION_FEE_USD } from "@/lib/tracking";

/**
 * GET /api/amazon/orders
 * Kullanıcının Amazon siparişleri + cüzdan bakiyesi + çevirme ücreti.
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const [user, orders] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { creditBalanceUsd: true } }),
    prisma.amazonOrder.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    balanceUsd: user?.creditBalanceUsd ?? 0,
    conversionFeeUsd: TRACKING_CONVERSION_FEE_USD,
    orders,
  });
});
