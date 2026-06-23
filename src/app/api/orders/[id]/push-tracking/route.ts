import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pushTrackingToEbay } from "@/lib/ebay/fulfill-order";

/**
 * POST /api/orders/[id]/push-tracking
 * Kullanıcı ekranda gözüken geçerli takip numarasını "eBay'e Gönder" butonuyla
 * müşterinin eBay mağazasına yükler. Ücret almaz (pay-tracking'te alındı).
 * eBay hatasında iade yok — kullanıcı tekrar deneyebilir.
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true, trackingNumber: true },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  if (!order.trackingNumber) {
    return NextResponse.json({ error: "Önce takip ödemesini yap" }, { status: 409 });
  }

  try {
    const result = await pushTrackingToEbay(id);
    return NextResponse.json({ ok: true, trackingNumber: result.trackingNumber, carrierCode: result.carrierCode });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "eBay'e yüklenemedi";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
