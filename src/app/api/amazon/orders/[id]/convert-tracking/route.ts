import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { convertTracking, TRACKING_CONVERSION_FEE_USD } from "@/lib/tracking";
import { TrackCaptainOutOfCreditsError } from "@/lib/trackcaptain";
import {
  notifyInsufficientBalance,
  notifyLowBalanceIfNeeded,
  notifyTrackCaptainOutOfCredits,
} from "@/lib/admin-notify";

/**
 * POST /api/amazon/orders/[id]/convert-tracking
 * "Oluştur": AliExpress numarasını geçerli son-mil numaraya çevirir.
 * Akış: ücreti REZERVE et (bakiyeden düş) → çevir → başarılıysa kaydet, başarısızsa İADE et.
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;
  const FEE = TRACKING_CONVERSION_FEE_USD;

  const order = await prisma.amazonOrder.findFirst({ where: { id, userId } });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  if (!order.aliTrackingNo) {
    return NextResponse.json({ error: "Önce AliExpress takip numarası girilmeli" }, { status: 400 });
  }
  if (order.validTrackingNo) {
    return NextResponse.json({ error: "Bu sipariş için zaten geçerli numara oluşturuldu" }, { status: 409 });
  }

  // 1. Atomik kapı + rezervasyon TEK transaction'da (çift ücretlendirme koruması).
  // Kapı: trackingStatus'u koşullu "converting" yapmak — iki paralel istekten yalnızca
  // biri geçer (ikincisi count=0). Bakiye yetersizse throw → kapı da geri sarılır.
  let gateOutcome: "ok" | "busy" | "insufficient";
  try {
    gateOutcome = await prisma.$transaction(async (tx) => {
      const gate = await tx.amazonOrder.updateMany({
        where: {
          id,
          userId,
          validTrackingNo: null,
          NOT: { trackingStatus: "converting" },
        },
        data: { trackingStatus: "converting" },
      });
      if (gate.count === 0) return "busy" as const;

      const reserve = await tx.user.updateMany({
        where: { id: userId, creditBalanceUsd: { gte: FEE } },
        data: { creditBalanceUsd: { decrement: FEE } },
      });
      if (reserve.count === 0) throw new Error("INSUFFICIENT_BALANCE");
      return "ok" as const;
    });
  } catch (txErr) {
    if (txErr instanceof Error && txErr.message === "INSUFFICIENT_BALANCE") {
      gateOutcome = "insufficient";
    } else {
      throw txErr;
    }
  }

  if (gateOutcome === "busy") {
    return NextResponse.json(
      { error: "Bu sipariş için çevirme zaten yapıldı veya devam ediyor" },
      { status: 409 }
    );
  }
  if (gateOutcome === "insufficient") {
    // Bakiye yetersiz → admin panele KRİTİK bildirim düş (sipariş kargosuz kalmasın)
    await notifyInsufficientBalance(userId, "takip kodu çevirme").catch(() => {});
    return NextResponse.json(
      { error: "Yetersiz bakiye", needTopUp: true, feeUsd: FEE },
      { status: 402 }
    );
  }

  // 2. Çevir — hata olursa ücreti İADE et
  try {
    const result = await convertTracking(order.aliTrackingNo);

    const [, updated] = await prisma.$transaction([
      prisma.creditTransaction.create({
        data: { userId, amountUsd: -FEE, type: "tracking_conversion", refId: id, note: "Takip kodu çevirme" },
      }),
      prisma.amazonOrder.update({
        where: { id },
        data: {
          validCarrierCode: result.carrierCode,
          validTrackingNo: result.trackingNumber,
          trackingStatus: "converted",
          status: result.delivered ? "delivered" : "shipped",
        },
      }),
    ]);

    // Ücret düşüldü — bakiye eşiğin altına indiyse admin panele UYARI düş
    await notifyLowBalanceIfNeeded(userId).catch(() => {});

    return NextResponse.json({ ok: true, order: updated, chargedUsd: FEE });
  } catch (err) {
    // İade + ledger + sipariş durumunu geri al
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { creditBalanceUsd: { increment: FEE } } }),
      prisma.creditTransaction.create({
        data: { userId, amountUsd: FEE, type: "refund", refId: id, note: "Çevirme başarısız — iade" },
      }),
      prisma.amazonOrder.update({ where: { id }, data: { trackingStatus: "failed" } }),
    ]);

    // Sahibin TrackCaptain kredisi bittiyse → admin panele KRİTİK bildirim
    if (err instanceof TrackCaptainOutOfCreditsError) {
      await notifyTrackCaptainOutOfCredits(err.creditBalance).catch(() => {});
    }

    const msg = err instanceof Error ? err.message : "Çevirme başarısız";
    return NextResponse.json({ error: msg, refunded: true }, { status: 502 });
  }
});
