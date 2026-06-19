import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/amazon/accounts/[id]
 * Bağlı Amazon hesabını kaldırır (yalnızca sahibi). Listelemeler cascade ile silinir.
 */
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;

  const account = await prisma.amazonAccount.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadı" }, { status: 404 });
  }

  await prisma.amazonAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
