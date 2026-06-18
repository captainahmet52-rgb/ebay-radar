import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { convertTracking, TRACKING_CONVERSION_FEE_USD } from "@/lib/tracking";

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

  // 1. Ücreti rezerve et — yalnızca yeterli bakiye varsa düşer (atomik koşullu update)
  const reserve = await prisma.user.updateMany({
    where: { id: userId, creditBalanceUsd: { gte: FEE } },
    data: { creditBalanceUsd: { decrement: FEE } },
  });
  if (reserve.count === 0) {
    return NextResponse.json(
      { error: "Yetersiz bakiye", needTopUp: true, feeUsd: FEE },
      { status: 402 }
    );
  }

  // 2. Çevir — hata olursa ücreti İADE et
  try {
    await prisma.amazonOrder.update({ where: { id }, data: { trackingStatus: "converting" } });

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

    const msg = err instanceof Error ? err.message : "Çevirme başarısız";
    return NextResponse.json({ error: msg, refunded: true }, { status: 502 });
  }
});
