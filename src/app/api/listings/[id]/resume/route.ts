import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct } from "@/lib/scraper";
import { calculateEbayPriceForMarket, determineQty } from "@/lib/repricer";
import { resolveExtraCosts } from "@/lib/cross-market";
import { resumeListing } from "@/lib/ebay/inventory";
import type { StockStatus } from "@/types";

export const PUT = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, userId },
      include: {
        ebayAccount: true,
        product: true,
        user: {
          select: {
            uploadProfitMarginPct: true,
            ebayIntlFeePct: true,
            ebayFxFeePct: true,
            crossExtraPct: true,
            crossExtraFixed: true,
          },
        },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Listing bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    if (listing.status === "active") {
      return NextResponse.json(
        { error: "Listing zaten aktif" },
        { status: 400 }
      );
    }

    // ABONELİK KAPISI: dondurulmuş (süresi bitmiş) mağazada ilan yeniden AÇILAMAZ —
    // worker o mağazayı takip etmediği için oversell riski doğar.
    if (!listing.ebayAccount?.isActive) {
      return NextResponse.json(
        { error: "Mağaza aboneliği aktif değil — önce paketi yenileyin" },
        { status: 403 }
      );
    }

    // 1. Taze Amazon verisi çek
    let scraperResult;
    try {
      scraperResult = await fetchAmazonProduct(
        listing.product.asin,
        listing.product.amazonMarket ?? "US"
      );
    } catch (err) {
      console.error("[resume scrape]", err);
      return NextResponse.json(
        { error: "Amazon verisi çekilemedi, tekrar deneyin" },
        { status: 502 }
      );
    }

    if (!scraperResult.price) {
      return NextResponse.json(
        { error: "Amazon fiyatı alınamadı, listing açılamıyor" },
        { status: 400 }
      );
    }

    const qty = determineQty(
      scraperResult.stockStatus as StockStatus,
      scraperResult.stockQty
    );

    if (qty === 0) {
      return NextResponse.json(
        { error: "Amazon stoğu yetersiz, listing açılamıyor" },
        { status: 400 }
      );
    }

    // 2. Yeni fiyat hesapla — eski fiyattan ASLA açma (CLAUDE.md Bölüm 4)
    // Pazar-bazlı (KDV/komisyon/kur) + kullanıcının marjı (yoksa ürün varsayılanı)
    const marginPct = listing.user?.uploadProfitMarginPct;
    const margin =
      marginPct != null && marginPct > 0 ? marginPct / 100 : listing.product.targetMargin;
    const repricerResult = await calculateEbayPriceForMarket(
      scraperResult.price,
      listing.product.amazonMarket,
      listing.ebaySite,
      listing.product.ebayFeeRate,
      margin,
      resolveExtraCosts(listing.user, listing.product.amazonMarket, listing.ebaySite)
    );

    // 3. eBay'de fiyat+qty güncelle — SKU (stok) + offerId (fiyat) gerektirir
    if (listing.ebaySku && listing.ebayOfferId) {
      try {
        await resumeListing(
          listing.ebayAccountId,
          listing.ebaySku,
          listing.ebayOfferId,
          qty,
          repricerResult.ebayPrice
        );
      } catch (err) {
        console.error("[resume eBay]", err);
        return NextResponse.json(
          { error: "eBay yeniden açma başarısız" },
          { status: 502 }
        );
      }
    }

    // 4. DB güncelle
    await prisma.product.update({
      where: { id: listing.productId },
      data: {
        amazonPrice: scraperResult.price,
        amazonStockStatus: scraperResult.stockStatus,
        amazonStockQty: scraperResult.stockQty,
        calculatedEbayPrice: repricerResult.ebayPrice,
        lastScrapedAt: new Date(),
      },
    });

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        status: "active",
        currentQty: qty,
        currentPrice: repricerResult.ebayPrice,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[listings/[id]/resume PUT]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
