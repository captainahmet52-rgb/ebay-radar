import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ code: z.string().min(1).max(40) });

/**
 * POST /api/coupons/redeem
 * Kupon kodunu kullanır → kullanıcının bonus gün bakiyesine (referralRewardDays)
 * kuponun rewardDays değerini ekler. Bu günler yeni mağaza bağlandığında denemeye eklenir.
 * Aynı kupon bir kullanıcı tarafından bir kez kullanılabilir.
 */
export const POST = requireAuth(async (req, { userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz kod" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code } });

  if (!coupon || !coupon.active) {
    return NextResponse.json({ error: "Geçersiz veya pasif kupon." }, { status: 404 });
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Bu kuponun süresi dolmuş." }, { status: 410 });
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return NextResponse.json({ error: "Bu kupon kullanım limitine ulaştı." }, { status: 409 });
  }

  // Daha önce kullanmış mı?
  const already = await prisma.couponRedemption.findUnique({
    where: { couponId_userId: { couponId: coupon.id, userId } },
  });
  if (already) {
    return NextResponse.json({ error: "Bu kuponu zaten kullandın." }, { status: 409 });
  }

  try {
    const [, updatedUser] = await prisma.$transaction([
      prisma.couponRedemption.create({ data: { couponId: coupon.id, userId } }),
      prisma.user.update({
        where: { id: userId },
        data: { referralRewardDays: { increment: coupon.rewardDays } },
        select: { referralRewardDays: true },
      }),
      prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      rewardDays: coupon.rewardDays,
      balance: updatedUser.referralRewardDays,
    });
  } catch {
    // unique çakışması (yarış) → zaten kullanılmış say
    return NextResponse.json({ error: "Bu kuponu zaten kullandın." }, { status: 409 });
  }
});
