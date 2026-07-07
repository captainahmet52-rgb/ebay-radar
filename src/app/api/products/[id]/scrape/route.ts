import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct } from "@/lib/scraper";
import { calculateEbayPriceForMarket, isPriceSpike, determineQty } from "@/lib/repricer";
import { resolveExtraCosts } from "@/lib/cross-market";

export const POST = requireAuth(async (req, { userId, params }) => {
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

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
    }

    // Uluslararası/çapraz maliyet ayarları (fiyat, yayındaki hesapla tutarlı olsun)
    const userFees = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ebayIntlFeePct: true,
        ebayFxFeePct: true,
        crossExtraPct: true,
        crossExtraFixed: true,
      },
    });

    let scraperResult;
    try {
      scraperResult = await fetchAmazonProduct(product.asin);
    } catch (err) {
      console.error("[scrape]", err);
      return NextResponse.json(
        { error: "Amazon verisi çekilemedi" },
        { status: 502 }
      );
    }

    const newPrice = scraperResult.price;

    let spikeDetected = false;
    if (product.amazonPrice && newPrice) {
      spikeDetected = isPriceSpike(product.amazonPrice, newPrice);
    }

    // Pazar-duyarlı eBay fiyatı (mağazanın pazarı + para birimi). Tek bir kez hesapla.
    const marketEbayPrice = newPrice
      ? (
          await calculateEbayPriceForMarket(
            newPrice,
            product.amazonMarket,
            listing.ebaySite,
            product.ebayFeeRate,
            product.targetMargin,
            resolveExtraCosts(userFees, product.amazonMarket, listing.ebaySite)
          )
        ).ebayPrice
      : null;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        title: scraperResult.title || undefined,
        imageUrl: scraperResult.imageUrl ?? undefined,
        amazonPrice: newPrice ?? undefined,
        amazonStockStatus: scraperResult.stockStatus,
        amazonStockQty: scraperResult.stockQty,
        lastScrapedAt: new Date(),
        calculatedEbayPrice:
          newPrice && !spikeDetected ? marketEbayPrice ?? undefined : undefined,
        pollTier:
          scraperResult.stockStatus === "low" || spikeDetected
            ? "hot"
            : product.pollTier,
      },
    });

    const qty = determineQty(scraperResult.stockStatus, scraperResult.stockQty);
    if (spikeDetected || qty === 0) {
      await prisma.listing.updateMany({
        where: { productId: id, status: "active" },
        data: { status: "paused", currentQty: 0 },
      });
    } else if (newPrice && marketEbayPrice !== null) {
      await prisma.listing.updateMany({
        where: { productId: id, status: "active" },
        data: { currentPrice: marketEbayPrice, currentQty: qty },
      });
    }

    return NextResponse.json({
      product: updatedProduct,
      spikeDetected,
      listingsPaused: spikeDetected || qty === 0,
    });
  } catch (err) {
    console.error("[products/[id]/scrape POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
