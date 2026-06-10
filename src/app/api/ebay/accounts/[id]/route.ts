import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const DELETE = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const account = await prisma.ebayAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Cascade ile bağlı listing'ler de silinir (schema'da onDelete: Cascade)
    await prisma.ebayAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ebay/accounts/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
