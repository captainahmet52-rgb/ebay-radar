import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { endListing } from "@/lib/ebay/inventory";

// Listing silme: eBay'de ilan ÖNCE sonlandırılır (qty 0 + offer withdraw),
// ancak eBay onayladıktan SONRA DB satırı silinir. Aksi halde "sildim" denip
// eBay'de satılabilir kalır → OVERSELL.
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;

    // Sahiplik kontrolü: listing oturum sahibinin mi?
    const listing = await prisma.listing.findFirst({
      where: { id, userId },
      select: {
        id: true,
        ebayListingId: true,
        ebaySku: true,
        ebayOfferId: true,
        ebayAccountId: true,
        product: { select: { asin: true } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // eBay'de yayında ise önce sonlandır. Token getValidToken üzerinden alınır
    // (endListing içinde). Başarısız olursa DB'yi SİLMEYİZ — oversell riski.
    if (listing.ebayListingId) {
      const sku = listing.ebaySku ?? (listing.product?.asin ? `EBAY-${listing.product.asin}` : null);
      try {
        await endListing(listing.ebayAccountId, sku, listing.ebayOfferId ?? null);
      } catch (err) {
        console.error("[listings DELETE eBay end]", err);
        return NextResponse.json(
          {
            error:
              "eBay ilanı sonlandırılamadı — oversell riski nedeniyle silme iptal edildi. Lütfen tekrar deneyin.",
          },
          { status: 502 }
        );
      }
    }

    // eBay güvenli — şimdi DB satırını sil.
    await prisma.listing.delete({ where: { id } });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[listings/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
