import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { storeLimitForUser } from "@/lib/plans";

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    // Token alanları HİÇBİR ZAMAN döndürülmez — sadece meta
    const [accounts, user] = await Promise.all([
      prisma.ebayAccount.findMany({
        where: { userId },
        select: {
          id: true,
          ebayUserId: true,
          marketplace: true,
          isActive: true,
          activatedAt: true,
          trialEndsAt: true,
          paidUntil: true,
          tokenExpiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true, trialEndsAt: true, lemonSqueezySubscriptionId: true },
      }),
    ]);

    const storeLimit = user
      ? storeLimitForUser(user.plan, user.trialEndsAt, user.lemonSqueezySubscriptionId)
      : 0;
    const activeCount = accounts.filter((a) => a.isActive).length;

    return NextResponse.json({
      data: accounts,
      meta: { storeLimit, activeCount, plan: user?.plan ?? null },
    });
  } catch (err) {
    console.error("[ebay/accounts GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
