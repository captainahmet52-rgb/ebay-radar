import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/amazon/accounts/[id]/activate — hesabı pasifleştirir (eBay'in
 * DELETE /api/ebay/accounts/[id]/activate'i ile aynı desen). Aktivasyon
 * admin/manuel akışla yapılır (ödeme sağlayıcısı yok — satın alma canlı
 * destek üzerinden yürür).
 */
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;
    const account = await prisma.amazonAccount.findFirst({ where: { id, userId } });
    if (!account) {
      return NextResponse.json(
        { error: "Amazon hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    await prisma.amazonAccount.update({
      where: { id },
      data: { isActive: false, activatedAt: null, paidUntil: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[amazon/accounts/[id]/activate DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
