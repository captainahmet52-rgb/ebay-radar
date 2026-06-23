import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { storeLimitForUser } from "@/lib/plans";

/**
 * Mağaza aktifleştirme. Plan limiti (storeLimit) dahilinde bir eBay mağazasını
 * aktif eder. Limit doluysa 402 + needUpgrade döner (kullanıcı paket yükseltmeli).
 * Sadece aktif mağazalara ürün yüklenir / radar çalışır.
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;

    const account = await prisma.ebayAccount.findFirst({ where: { id, userId } });
    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    if (account.isActive) {
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, trialEndsAt: true, stripeSubscriptionId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const limit = storeLimitForUser(user.plan, user.trialEndsAt, user.stripeSubscriptionId);
    const activeCount = await prisma.ebayAccount.count({
      where: { userId, isActive: true },
    });

    if (activeCount >= limit) {
      return NextResponse.json(
        {
          error:
            limit === 0
              ? "Mağaza aktifleştirmek için bir paket almanız gerekiyor."
              : `Paketinizin mağaza limiti dolu (${activeCount}/${limit}). Daha fazla mağaza için paketinizi yükseltin.`,
          needUpgrade: true,
          activeCount,
          limit,
        },
        { status: 402 }
      );
    }

    await prisma.ebayAccount.update({
      where: { id },
      data: { isActive: true, activatedAt: new Date() },
    });

    return NextResponse.json({ success: true, activeCount: activeCount + 1, limit });
  } catch (err) {
    console.error("[ebay/accounts/[id]/activate POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

/** Mağaza pasifleştirme (limitten düşürür, başka mağaza aktif edilebilir). */
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;
    const account = await prisma.ebayAccount.findFirst({ where: { id, userId } });
    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    await prisma.ebayAccount.update({
      where: { id },
      data: { isActive: false, activatedAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ebay/accounts/[id]/activate DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
