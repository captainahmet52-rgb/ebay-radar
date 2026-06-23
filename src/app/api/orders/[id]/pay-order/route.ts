import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { notifyInsufficientBalance } from "@/lib/admin-notify";

/**
 * POST /api/orders/[id]/pay-order
 * Kullanıcı, managed siparişin maliyetini (Amazon maliyeti + markup) cüzdandan öder.
 * → managedStatus = awaiting_tracking_payment (sonra takip ödemesi yapılır).
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true, managedStatus: true, sourceCostUsd: true, markupUsd: true },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  if (order.managedStatus !== "awaiting_order_payment") {
    return NextResponse.json({ error: "Bu sipariş ödeme aşamasında değil" }, { status: 409 });
  }

  const total = (order.sourceCostUsd ?? 0) + (order.markupUsd ?? 0);
  if (total <= 0) {
    return NextResponse.json({ error: "Sipariş tutarı hesaplanmadı" }, { status: 400 });
  }

  // Atomik koşullu düşme — yeterli bakiye varsa
  const reserve = await prisma.user.updateMany({
    where: { id: userId, creditBalanceUsd: { gte: total } },
    data: { creditBalanceUsd: { decrement: total } },
  });
  if (reserve.count === 0) {
    await notifyInsufficientBalance(userId, "managed sipariş ödemesi").catch(() => {});
    return NextResponse.json({ error: "Yetersiz bakiye — cüzdana yükle", needTopUp: true, amount: total }, { status: 402 });
  }

  await prisma.$transaction([
    prisma.creditTransaction.create({
      data: { userId, amountUsd: -total, type: "order_purchase", refId: id, note: "Managed sipariş (maliyet + markup)" },
    }),
    prisma.order.update({
      where: { id },
      data: { orderChargePaidAt: new Date(), managedStatus: "awaiting_tracking_payment" },
    }),
  ]);

  return NextResponse.json({ ok: true, chargedUsd: total });
});
