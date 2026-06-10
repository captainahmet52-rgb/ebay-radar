import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.depotProduct.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sourceStore: { select: { ebayUsername: true } },
        _count: { select: { distributions: true } },
      },
    }),
    prisma.depotProduct.count(),
  ]);

  return NextResponse.json({
    data: products,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
