import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shopify/orders — kullanıcının Shopify siparişleri (en yeni önce).
 * Sipariş verisi worker'ın 30 dakikalık senkronuyla dolar; müşteri PII'ı
 * saklanmadığı için burada da dönmez.
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const orders = await prisma.shopifyOrder.findMany({
    where: { userId },
    orderBy: { shopifyCreatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      totalPrice: true,
      currency: true,
      financialStatus: true,
      fulfillmentStatus: true,
      lineItems: true,
      sourcingStatus: true,
      aliCostUsd: true,
      shopifyCreatedAt: true,
      shopifyAccount: { select: { shopDomain: true } },
    },
  });

  return NextResponse.json({ orders });
});
