import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20", 10));
  const skip = (page - 1) * limit;

  // Kullanıcının dağıtılan ürünlerini getir
  const [distributions, total] = await Promise.all([
    prisma.productDistribution.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { distributedAt: "desc" },
      include: { depotProduct: true, listing: true },
    }),
    prisma.productDistribution.count({ where: { userId } }),
  ]);

  // Kullanıcı limiti
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { productLimit: true },
  });

  return NextResponse.json({
    data: distributions,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      productLimit: user?.productLimit ?? 100,
      used: total,
      remaining: (user?.productLimit ?? 100) - total,
    },
  });
});
