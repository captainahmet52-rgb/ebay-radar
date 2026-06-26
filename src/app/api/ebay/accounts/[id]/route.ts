import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { endListing } from "@/lib/ebay/inventory";
import { reviseInventoryStatus } from "@/lib/ebay/trading";
import { getValidToken } from "@/lib/ebay/oauth";

export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;

    const account = await prisma.ebayAccount.findFirst({
      where: { id, userId },
      include: {
        listings: {
          select: { id: true, ebaySku: true, ebayOfferId: true, ebayListingId: true, isLegacy: true, status: true },
        },
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // ÖNEMLİ: DB'den silmeden ÖNCE eBay'deki canlı ilanları sonlandır/durdur.
    // Yoksa eBay'de takipsiz canlı ilan kalır → satılırsa kayıt/karşılama yok = risk.
    // Best-effort: her ilanı dene, hata olsa bile silmeye devam et (kullanıcı ayrılıyor).
    const liveListings = account.listings.filter((l) => l.status !== "ended" && l.ebayListingId);
    if (liveListings.length > 0) {
      let token: string | null = null;
      for (const l of liveListings) {
        try {
          if (l.isLegacy && l.ebayListingId) {
            // Legacy ilan: Trading API ile qty 0 (satışı durdur)
            token = token ?? (await getValidToken(id));
            await reviseInventoryStatus(token, account.marketplace, l.ebayListingId, null, 0);
          } else if (l.ebaySku || l.ebayOfferId) {
            // Managed ilan: Inventory API ile sonlandır (qty 0 + offer withdraw)
            await endListing(id, l.ebaySku, l.ebayOfferId);
          }
        } catch (e) {
          console.warn(`[ebay/accounts DELETE] ilan sonlandırılamadı: ${l.id} — ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    // Cascade ile bağlı listing'ler de silinir (schema'da onDelete: Cascade)
    await prisma.ebayAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ebay/accounts/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
