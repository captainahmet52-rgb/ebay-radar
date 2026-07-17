import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { calculateShopifyPrice } from "@/lib/shopify/pricing";

/**
 * GET /api/shopify/depot — ORTAK DEPO'nun kullanıcıya açık görünümü.
 * Admin deposundan (GET /api/amazon/depot) farkı: radar istihbaratı (BSR, satıcı
 * sayısı, skor) SIZDIRILMAZ; yalnız seçim için gereken alanlar + önerilen satış
 * fiyatı/kâr döner. Kullanıcı buradan seçip "Shopify'a Yükle" der.
 */
export const GET = requireAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const PAGE_SIZE = 24;

  const where = {
    status: "active",
    brandSafe: true,
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.amazonDepotProduct.count({ where }),
    prisma.amazonDepotProduct.findMany({
      where,
      select: {
        id: true,
        title: true,
        imageUrl: true,
        category: true,
        aliCostUsd: true,
        aliShippingUsd: true,
        aliOrders: true,
        aliRating: true,
        aliStockStatus: true,
      },
      orderBy: [{ aliOrders: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    products: products.map((p) => {
      const pricing = calculateShopifyPrice(p.aliCostUsd, p.aliShippingUsd);
      return {
        ...p,
        suggestedPrice: pricing.salePrice,
        estimatedProfitUsd: pricing.estimatedProfitUsd,
      };
    }),
  });
});
