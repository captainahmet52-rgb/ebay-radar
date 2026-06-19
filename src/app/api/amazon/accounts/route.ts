import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/amazon/accounts
 * Kullanıcının bağlı Amazon satıcı hesapları (token alanları ASLA dönmez).
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const accounts = await prisma.amazonAccount.findMany({
    where: { userId },
    select: {
      id: true,
      sellerId: true,
      market: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: accounts });
});
