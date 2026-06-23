import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ensureReferralCode } from "@/lib/referral";
import { SITE } from "@/lib/site";

/**
 * GET /api/affiliate
 * Kullanıcının ortaklık (affiliate) durumunu döndürür. Affiliate ise tanıtım
 * linki, getirdiği kullanıcı sayısı, komisyon oranı ve biriken bakiyeyi verir.
 * Affiliate değilse isAffiliate=false döner (sayfa başvuru ekranı gösterir).
 */
export const GET = requireAuth(async (_req, { userId }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAffiliate: true, commissionRatePct: true, commissionBalanceUsd: true },
    });

    if (!user?.isAffiliate) {
      return NextResponse.json({ isAffiliate: false });
    }

    const code = await ensureReferralCode(userId);
    const referredCount = await prisma.user.count({ where: { referredById: userId } });

    return NextResponse.json({
      isAffiliate: true,
      link: `${SITE.url}/register?ref=${code}`,
      code,
      referredCount,
      commissionRatePct: user.commissionRatePct,
      commissionBalanceUsd: user.commissionBalanceUsd,
    });
  } catch (err) {
    console.error("[affiliate GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
