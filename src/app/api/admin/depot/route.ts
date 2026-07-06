import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip = (page - 1) * limit;

  // Opsiyonel durum filtresi (active | review | rejected). Verilmezse tümü.
  const statusParam = searchParams.get("status");
  // Opsiyonel yükleme filtresi: yes = en az bir mağazaya yüklenmiş, no = boşta.
  const uploadedParam = searchParams.get("uploaded");

  // Yüklenmiş ASIN'ler: ASIN'i depoyla eşleşen ve kapatılmamış en az bir
  // listing'i olan ürünler. Stok kontrol de yalnız bunlar için çalışır.
  const uploadedProducts = await prisma.product.findMany({
    where: { listings: { some: { status: { not: "ended" } } } },
    select: {
      asin: true,
      _count: { select: { listings: { where: { status: { not: "ended" } } } } },
    },
  });
  const uploadedByAsin = new Map(uploadedProducts.map((p) => [p.asin, p._count.listings]));
  const uploadedAsins = [...uploadedByAsin.keys()];

  const where = {
    ...(statusParam ? { status: statusParam } : {}),
    ...(uploadedParam === "yes"
      ? { asin: { in: uploadedAsins } }
      : uploadedParam === "no"
        ? { asin: { notIn: uploadedAsins } }
        : {}),
  };

  const [products, total, reviewCount, uploadedTotal, grandTotal] = await Promise.all([
    prisma.depotProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { distributions: true } },
      },
    }),
    prisma.depotProduct.count({ where }),
    prisma.depotProduct.count({ where: { status: "review" } }),
    // Başlık çipleri için: depodaki kaç ürün en az bir mağazaya yüklenmiş
    prisma.depotProduct.count({ where: { asin: { in: uploadedAsins } } }),
    // Filtreden bağımsız genel toplam — "Boşta" sayısı bununla hesaplanır
    prisma.depotProduct.count(),
  ]);

  const data = products.map((p) => ({
    ...p,
    uploadedListings: uploadedByAsin.get(p.asin) ?? 0,
  }));

  return NextResponse.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      reviewCount,
      uploadedTotal,
      grandTotal,
    },
  });
});
