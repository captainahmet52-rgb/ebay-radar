import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { EbayClient } from "@/lib/ebay-client";
import { decryptToken } from "@/lib/crypto";

export const DELETE = requireAuth(async (req, { userId, params }) => {
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

    if (listing.ebayListingId && listing.ebayAccount.oauthTokenEncrypted) {
      try {
        const accessToken = decryptToken(listing.ebayAccount.oauthTokenEncrypted);
        const client = new EbayClient(accessToken);
        await client.post(
          `/sell/inventory/v1/bulk_migrate_listing`,
          { requests: [{ listingId: listing.ebayListingId }] }
        );
      } catch (err) {
        console.warn("[listings DELETE eBay]", err);
      }
    }

    await prisma.listing.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[listings/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
