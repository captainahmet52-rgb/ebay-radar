import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAuth(async (_req, { userId }) => {
  try {
    // Token alanları HİÇBİR ZAMAN döndürülmez — sadece meta
    const accounts = await prisma.ebayAccount.findMany({
      where: { userId },
      select: {
        id: true,
        ebayUserId: true,
        tokenExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: accounts });
  } catch (err) {
    console.error("[ebay/accounts GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
