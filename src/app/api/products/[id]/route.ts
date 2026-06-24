import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { endListing } from "@/lib/ebay/inventory";

export const GET = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { userId, productId: id },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Ürün bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: { select: { listings: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error("[products/[id] GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;

    // Sahiplik + bu kullanıcının bu ürüne bağlı tüm listing'leri.
    const listings = await prisma.listing.findMany({
      where: { userId, productId: id },
      select: {
        id: true,
        ebayListingId: true,
        ebaySku: true,
        ebayOfferId: true,
        ebayAccountId: true,
        product: { select: { asin: true } },
      },
    });

    if (listings.length === 0) {
      return NextResponse.json(
        { error: "Ürün bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Silmeden ÖNCE eBay'de yayında olan her ilanı sonlandır (qty 0 + withdraw).
    // Herhangi biri başarısız olursa hiçbir DB satırını silmeyiz → oversell riski.
    for (const listing of listings) {
      if (!listing.ebayListingId) continue;
      const sku =
        listing.ebaySku ??
        (listing.product?.asin ? `EBAY-${listing.product.asin}` : null);
      try {
        await endListing(listing.ebayAccountId, sku, listing.ebayOfferId ?? null);
      } catch (err) {
        console.error("[products DELETE eBay end]", err);
        return NextResponse.json(
          {
            error:
              "eBay ilanları sonlandırılamadı — oversell riski nedeniyle silme iptal edildi. Lütfen tekrar deneyin.",
          },
          { status: 502 }
        );
      }
    }

    // eBay güvenli — şimdi DB satırlarını sil.
    await prisma.listing.deleteMany({
      where: { userId, productId: id },
    });

    const remainingListings = await prisma.listing.count({
      where: { productId: id },
    });

    if (remainingListings === 0) {
      await prisma.product.delete({ where: { id } });
    }

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[products/[id] DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
