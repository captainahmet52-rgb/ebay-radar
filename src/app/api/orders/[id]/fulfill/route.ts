import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { fulfillEbayOrder, InsufficientWalletError } from "@/lib/ebay/fulfill-order";
import { TrackCaptainOutOfCreditsError } from "@/lib/trackcaptain";

/**
 * POST /api/orders/[id]/fulfill
 * Siparişi kargolar: TrackCaptain'dan geçerli takip no al → eBay'e yükle → cüzdandan $0.43.
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;

    // Sahiplik kontrolü
    const order = await prisma.order.findFirst({ where: { id, userId }, select: { id: true } });
    if (!order) {
      return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
    }

    try {
      const result = await fulfillEbayOrder(id);
      return NextResponse.json({ ok: true, ...result });
    } catch (err) {
      if (err instanceof InsufficientWalletError) {
        return NextResponse.json({ error: "Yetersiz bakiye — cüzdana yükle", needTopUp: true }, { status: 402 });
      }
      if (err instanceof TrackCaptainOutOfCreditsError) {
        return NextResponse.json({ error: "Takip sağlayıcı kredisi bitti — admin'e bildirildi", systemIssue: true }, { status: 503 });
      }
      const msg = err instanceof Error ? err.message : "Kargolama başarısız";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err) {
    console.error("[orders/[id]/fulfill POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
