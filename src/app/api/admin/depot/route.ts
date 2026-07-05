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
  const where = statusParam ? { status: statusParam } : {};

  const [products, total, reviewCount] = await Promise.all([
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
  ]);

  return NextResponse.json({
    data: products,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), reviewCount },
  });
});
