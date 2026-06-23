import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { claimTrackingForOrder, InsufficientWalletError } from "@/lib/ebay/fulfill-order";
import { TrackCaptainOutOfCreditsError } from "@/lib/trackcaptain";

/**
 * POST /api/orders/[id]/pay-tracking
 * Kullanıcı takip ücretini öder → o AN sistem TrackCaptain'dan geçerli no üretir ve
 * kullanıcıya GÖSTERİR (reveal). eBay'e HENÜZ yüklenmez — kullanıcı ekrandaki
 * "eBay'e Gönder" butonuna basınca yüklenir (push-tracking). Ücret claim içinde
 * cüzdandan düşülür ($0.43); hata olursa iade edilir.
 */
export const POST = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    select: { id: true, managedStatus: true },
  });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });
  if (order.managedStatus !== "awaiting_tracking_payment") {
    return NextResponse.json({ error: "Önce sipariş ödemesini yap" }, { status: 409 });
  }

  try {
    const result = await claimTrackingForOrder(id);
    // Geçerli takip no kullanıcıya gösterilir (reveal); eBay'e yükleme ayrı butonla
    return NextResponse.json({ ok: true, trackingNumber: result.trackingNumber, carrierCode: result.carrierCode });
  } catch (err) {
    if (err instanceof InsufficientWalletError) {
      return NextResponse.json({ error: "Takip ücreti için yetersiz bakiye", needTopUp: true }, { status: 402 });
    }
    if (err instanceof TrackCaptainOutOfCreditsError) {
      return NextResponse.json({ error: "Takip sağlayıcı kredisi bitti — birazdan tekrar dene", systemIssue: true }, { status: 503 });
    }
    const msg = err instanceof Error ? err.message : "Takip oluşturulamadı";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
