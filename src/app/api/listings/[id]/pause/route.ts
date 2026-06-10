import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pauseListing } from "@/lib/ebay/inventory";

export const PUT = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, userId },
      include: { ebayAccount: true },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    if (listing.status === "paused") {
      return NextResponse.json(
        { error: "Listing zaten duraklatılmış" },
        { status: 400 }
      );
    }

    // eBay'de duraklat — bulk_update_price_quantity SKU ister, listingId değil
    if (listing.ebaySku) {
      try {
        await pauseListing(listing.ebayAccountId, listing.ebaySku);
      } catch (err) {
        console.error("[pause eBay]", err);
        return NextResponse.json(
          { error: "eBay duraklatma başarısız" },
          { status: 502 }
        );
      }
    }

    const updated = await prisma.listing.update({
      where: { id },
      data: { status: "paused", currentQty: 0 },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[listings/[id]/pause PUT]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
