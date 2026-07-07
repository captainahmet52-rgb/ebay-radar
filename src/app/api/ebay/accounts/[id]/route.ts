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
    // Hesap silme CASCADE ile Listing'leri VE Order geçmişini de siler (schema);
    // bir ilan sonlandırılamadan hesap silinirse o ilan eBay'de TAKİPSİZ canlı
    // kalır (stok/fiyat senkronu, oversell koruması biter) VE geçmiş siparişleri
    // kalıcı kaybolur. Bu yüzden products/[id] DELETE ile AYNI kural: biri
    // başarısız olursa hiçbir şey silinmez (yarım "best-effort" silme YOK).
    // Eş zamanlı denenir (yüzlerce/binlerce ilanda sıralı denemek dakikalar sürer
    // ve eBay'i hız sınırına çarptırabilir).
    const liveListings = account.listings.filter((l) => l.status !== "ended" && l.ebayListingId);
    if (liveListings.length > 0) {
      const token = liveListings.some((l) => l.isLegacy) ? await getValidToken(id) : null;
      const results = await Promise.allSettled(
        liveListings.map((l) => {
          if (l.isLegacy && l.ebayListingId) {
            // Legacy ilan: Trading API ile qty 0 (satışı durdur)
            return reviseInventoryStatus(token!, account.marketplace, l.ebayListingId, null, 0);
          }
          if (l.ebaySku || l.ebayOfferId) {
            // Managed ilan: Inventory API ile sonlandır (qty 0 + offer withdraw)
            return endListing(id, l.ebaySku, l.ebayOfferId);
          }
          return Promise.resolve();
        })
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        for (const f of failures) {
          console.error("[ebay/accounts DELETE] ilan sonlandırılamadı:", (f as PromiseRejectedResult).reason);
        }
        return NextResponse.json(
          {
            error: `${failures.length}/${liveListings.length} ilan eBay'de sonlandırılamadı — oversell riski nedeniyle hesap silme iptal edildi. Lütfen tekrar deneyin.`,
          },
          { status: 502 }
        );
      }
    }

    // Tüm canlı ilanlar güvenle sonlandırıldı — CASCADE ile bağlı listing'ler
    // ve sipariş geçmişi de silinir (schema'da onDelete: Cascade).
    await prisma.ebayAccount.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ebay/accounts/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
