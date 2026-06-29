import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createOrUpdateListing } from "@/lib/ebay-listings";
import { calculateEbayPriceForMarket, determineQty } from "@/lib/repricer";
import type { StockStatus } from "@/types";

export const GET = requireAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: true,
          ebayAccount: {
            select: {
              id: true,
              ebayUserId: true,
              tokenExpiresAt: true,
            },
          },
        },
      }),
      prisma.listing.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      data: listings,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[listings GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

export const POST = requireAuth(async (req, { userId }) => {
  try {
    const body = await req.json() as { productId?: string; ebayAccountId?: string };
    const { productId, ebayAccountId } = body;

    if (!productId || !ebayAccountId) {
      return NextResponse.json(
        { error: "productId ve ebayAccountId zorunludur" },
        { status: 400 }
      );
    }

    // eBay hesabı sahipliği (IDOR koruması): hesap MUTLAKA mevcut oturum
    // kullanıcısına ait olmalı — başkasının mağazasına listeleme engellenir.
    const ebayAccount = await prisma.ebayAccount.findFirst({
      where: { id: ebayAccountId, userId },
    });

    if (!ebayAccount) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Ürün global ASIN deposundan gelir (kullanıcıya özel değil), yine de var olmalı.
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    if (!product.amazonPrice) {
      return NextResponse.json(
        { error: "Ürünün Amazon fiyatı henüz çekilmemiş" },
        { status: 400 }
      );
    }

    // Mükerrer önleme: bu kullanıcının bu ürün için zaten bir listesi var mı?
    const existing = await prisma.listing.findFirst({
      where: { userId, productId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Bu ürün için zaten bir listeniz var" },
        { status: 409 }
      );
    }

    // Sadece aktif mağazalara listeleme yapılır
    if (!ebayAccount.isActive) {
      return NextResponse.json(
        { error: "Mağaza aktif değil. Mağazalarım'dan aktifleştir.", needActivation: true },
        { status: 402 }
      );
    }

    // PAKET = MAĞAZA: ürün limiti bu mağazanın paketine özeldir (mağaza-başına sayım).
    const usedCount = await prisma.listing.count({ where: { userId, ebayAccountId } });
    if (usedCount >= ebayAccount.productLimit) {
      return NextResponse.json(
        { error: `Ürün limitine ulaştın (${ebayAccount.productLimit}). Bu mağazanın paketini yükselt.`, needUpgrade: true },
        { status: 403 }
      );
    }

    // Kullanıcının kâr marjı ayarı (yüzde) — yoksa ürün varsayılanına düş
    const settings = await prisma.user.findUnique({
      where: { id: userId },
      select: { uploadProfitMarginPct: true },
    });
    const margin =
      settings?.uploadProfitMarginPct != null && settings.uploadProfitMarginPct > 0
        ? settings.uploadProfitMarginPct / 100
        : product.targetMargin;

    // Fiyat + qty hesapla — mağazanın pazarına göre (KDV/komisyon/kur) + kullanıcının marjıyla
    const repricerResult = await calculateEbayPriceForMarket(
      product.amazonPrice,
      product.amazonMarket,
      ebayAccount.marketplace,
      product.ebayFeeRate,
      margin
    );
    const qty = determineQty(
      product.amazonStockStatus as StockStatus,
      product.amazonStockQty
    );

    // eBay'de listele
    let ebayListingId: string | undefined;
    let ebayOfferId: string | undefined;
    let ebaySku: string | undefined;
    try {
      const identifiers = await createOrUpdateListing(
        ebayAccount,
        product,
        qty,
        repricerResult.ebayPrice
      );
      ebayListingId = identifiers.listingId;
      ebayOfferId   = identifiers.offerId;
      ebaySku       = identifiers.sku;
    } catch (err) {
      console.error("[listings POST eBay]", err);
      return NextResponse.json(
        { error: "eBay listeleme başarısız oldu" },
        { status: 502 }
      );
    }

    const listing = await prisma.listing.create({
      data: {
        userId,
        productId,
        ebayAccountId,
        ebayListingId,
        ebayOfferId,
        ebaySku,
        ebaySite: ebayAccount.marketplace, // mağazanın tespit edilen pazarı
        currentQty: qty,
        currentPrice: repricerResult.ebayPrice,
        status: qty === 0 ? "paused" : "active",
      },
      include: { product: true },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    console.error("[listings POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
