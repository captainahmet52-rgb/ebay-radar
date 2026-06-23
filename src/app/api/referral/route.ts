import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ensureReferralCode, REFERRAL_REWARD_DAYS } from "@/lib/referral";
import { SITE } from "@/lib/site";

/**
 * GET /api/referral
 * Kullanıcının davet kodunu (yoksa üretir), davet linkini, davet sayısını ve
 * biriken ödül günlerini döndürür.
 */
export const GET = requireAuth(async (_req, { userId }) => {
  try {
    const code = await ensureReferralCode(userId);

    const [referralCount, user] = await Promise.all([
      prisma.user.count({ where: { referredById: userId } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { referralRewardDays: true },
      }),
    ]);

    return NextResponse.json({
      code,
      link: `${SITE.url}/register?ref=${code}`,
      referralCount,
      rewardDays: user?.referralRewardDays ?? 0,
      rewardPerInvite: REFERRAL_REWARD_DAYS,
    });
  } catch (err) {
    console.error("[referral GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
