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
  try {
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

    // ÇİFT ÖDEME KORUMASI: durum geçişi + bakiye düşme + ledger TEK transaction'da.
    // Kapı = koşullu durum geçişi (updateMany count). İki paralel istekten yalnızca
    // biri "awaiting_order_payment" satırını yakalar; ikincisi count=0 alır.
    // Bakiye yetersizse throw → transaction geri sarılır (durum geçişi de geri alınır).
    let outcome: "ok" | "already_paid" | "insufficient";
    try {
      outcome = await prisma.$transaction(async (tx) => {
        const gate = await tx.order.updateMany({
          where: { id, userId, managedStatus: "awaiting_order_payment" },
          data: { orderChargePaidAt: new Date(), managedStatus: "awaiting_tracking_payment" },
        });
        if (gate.count === 0) return "already_paid" as const;

        const reserve = await tx.user.updateMany({
          where: { id: userId, creditBalanceUsd: { gte: total } },
          data: { creditBalanceUsd: { decrement: total } },
        });
        if (reserve.count === 0) {
          // Rollback için throw — durum geçişi de geri sarılır
          throw new Error("INSUFFICIENT_BALANCE");
        }

        await tx.creditTransaction.create({
          data: { userId, amountUsd: -total, type: "order_purchase", refId: id, note: "Managed sipariş (maliyet + markup)" },
        });
        return "ok" as const;
      });
    } catch (txErr) {
      if (txErr instanceof Error && txErr.message === "INSUFFICIENT_BALANCE") {
        outcome = "insufficient";
      } else {
        throw txErr;
      }
    }

    if (outcome === "already_paid") {
      return NextResponse.json({ error: "Bu sipariş ödeme aşamasında değil" }, { status: 409 });
    }
    if (outcome === "insufficient") {
      await notifyInsufficientBalance(userId, "managed sipariş ödemesi").catch(() => {});
      return NextResponse.json({ error: "Yetersiz bakiye — cüzdana yükle", needTopUp: true, amount: total }, { status: 402 });
    }

    return NextResponse.json({ ok: true, chargedUsd: total });
  } catch (err) {
    console.error("[orders/[id]/pay-order POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
