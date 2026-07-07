import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { fetchAmazonProduct } from "@/lib/scraper";
import { calculateEbayPriceForMarket } from "@/lib/repricer";
import { resolveExtraCosts } from "@/lib/cross-market";

const ASIN_REGEX = /^[A-Z0-9]{10}$/;
const MIN_PRICE = 15;

export const GET = requireAuth(async (req, { userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const pollTier = searchParams.get("pollTier");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    // Kullanıcıya ait listing'ler üzerinden product ID'lerini bul
    const userListings = await prisma.listing.findMany({
      where: { userId },
      select: { productId: true },
    });
    const productIds = userListings.map((l) => l.productId);

    const where: Record<string, unknown> = {
      id: { in: productIds },
    };

    if (status) where.status = status;
    if (pollTier) where.pollTier = pollTier;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { asin: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("[products GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

export const POST = requireAuth(async (req, { userId }) => {
  try {
    const body = await req.json() as { asin?: string };
    const { asin } = body;

    if (!asin) {
      return NextResponse.json({ error: "ASIN zorunludur" }, { status: 400 });
    }

    const normalizedAsin = asin.trim().toUpperCase();

    if (!ASIN_REGEX.test(normalizedAsin)) {
      return NextResponse.json(
        { error: "ASIN 10 haneli alfanumerik olmalıdır (örn: B08N5WRWNW)" },
        { status: 400 }
      );
    }

    // Kullanıcının ürün limitini kontrol et
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        productLimit: true,
        uploadSourceMarket: true,
        uploadEbaySite: true,
        uploadProfitMarginPct: true,
        ebayIntlFeePct: true,
        ebayFxFeePct: true,
        crossExtraPct: true,
        crossExtraFixed: true,
        _count: { select: { productDistributions: true } },
      },
    });
    const usedCount = user?._count.productDistributions ?? 0;
    const productLimit = user?.productLimit ?? 100;
    if (usedCount >= productLimit) {
      return NextResponse.json(
        { error: `Ürün limitinize ulaştınız (${productLimit} ürün). Planınızı yükseltin.` },
        { status: 403 }
      );
    }

    // Amazon pazarı: ürün depoda zaten varsa ONUN pazarı (global ürün tek pazarlıdır,
    // farklı pazardan fiyatla üzerine yazılmaz); yeni üründe kullanıcının kaynak pazarı.
    const existingProduct = await prisma.product.findUnique({
      where: { asin: normalizedAsin },
      select: { amazonMarket: true },
    });
    const amazonMarket = existingProduct?.amazonMarket ?? user?.uploadSourceMarket ?? "US";

    // Amazon'dan veri çek
    let scraperResult;
    try {
      scraperResult = await fetchAmazonProduct(normalizedAsin, amazonMarket);
    } catch (err) {
      console.error("[products POST scrape]", err);
      return NextResponse.json(
        { error: "Amazon verisi çekilemedi" },
        { status: 502 }
      );
    }

    if (!scraperResult.price) {
      return NextResponse.json(
        { error: "Amazon fiyatı bulunamadı" },
        { status: 400 }
      );
    }

    // 15$ altı ürünleri reddet
    if (scraperResult.price < MIN_PRICE) {
      return NextResponse.json(
        { error: `Minimum ürün fiyatı ${MIN_PRICE}$. Bu ürün ${scraperResult.price}$.` },
        { status: 400 }
      );
    }

    // Fiyat hesapla — kullanıcının eBay pazarına göre (kur + KDV + komisyon)
    // + kullanıcı marjı + uluslararası/çapraz maliyetler (yayındaki fiyatla tutarlı önizleme)
    const previewEbaySite = user?.uploadEbaySite ?? "EBAY_US";
    const previewMargin =
      user?.uploadProfitMarginPct != null && user.uploadProfitMarginPct > 0
        ? user.uploadProfitMarginPct / 100
        : 0.20;
    const repricerResult = await calculateEbayPriceForMarket(
      scraperResult.price,
      amazonMarket,
      previewEbaySite,
      0.136,
      previewMargin,
      resolveExtraCosts(user, amazonMarket, previewEbaySite)
    );

    // DB'ye yaz veya güncelle
    const product = await prisma.product.upsert({
      where: { asin: normalizedAsin },
      create: {
        asin: normalizedAsin,
        title: scraperResult.title || null,
        imageUrl: scraperResult.imageUrl,
        amazonMarket,
        amazonPrice: scraperResult.price,
        amazonStockStatus: scraperResult.stockStatus,
        amazonStockQty: scraperResult.stockQty,
        calculatedEbayPrice: repricerResult.ebayPrice,
        lastScrapedAt: new Date(),
        status: "active",
        pollTier: "normal",
      },
      update: {
        title: scraperResult.title || undefined,
        imageUrl: scraperResult.imageUrl ?? undefined,
        amazonPrice: scraperResult.price,
        amazonStockStatus: scraperResult.stockStatus,
        amazonStockQty: scraperResult.stockQty,
        calculatedEbayPrice: repricerResult.ebayPrice,
        lastScrapedAt: new Date(),
      },
    });

    // Modal'ın beklediği önizleme alanları (ebayPrice/netProfit/marginPct) ürün
    // kaydında yoktur — repricer sonucundan eklenir (marginPct yüzde olarak).
    return NextResponse.json(
      {
        ...product,
        ebayPrice: repricerResult.ebayPrice,
        netProfit: repricerResult.netProfit,
        marginPct: repricerResult.marginPct * 100,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[products POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
