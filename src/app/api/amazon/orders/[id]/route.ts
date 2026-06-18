import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  aliTrackingNo: z.string().trim().min(4).max(64),
});

/**
 * PATCH /api/amazon/orders/[id]
 * Siparişe AliExpress takip numarasını elle girer (AliExpress API gelince otomatik dolacak).
 */
export const PATCH = requireAuth(async (req, { userId, params }) => {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz takip numarası" }, { status: 400 });
  }

  const order = await prisma.amazonOrder.findFirst({ where: { id, userId }, select: { id: true } });
  if (!order) {
    return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  }

  const updated = await prisma.amazonOrder.update({
    where: { id },
    data: { aliTrackingNo: parsed.data.aliTrackingNo, trackingStatus: "pending" },
  });

  return NextResponse.json({ ok: true, order: updated });
});
