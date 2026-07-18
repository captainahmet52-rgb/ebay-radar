import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/shopify — ShopifyBot yönetim görünümü:
 * sistem istatistikleri + bağlı mağazalar (sahip e-postasıyla) + son siparişler.
 * Token asla dönmez.
 */
export const GET = requireAdmin(async () => {
  const [
    accounts,
    orders,
    accountsTotal,
    accountsActive,
    accountsFrozen,
    accountsUninstalled,
    listingsTotal,
    listingsActive,
    ordersTotal,
    riskOrders,
  ] = await Promise.all([
    prisma.shopifyAccount.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        shopDomain: true,
        isActive: true,
        plan: true,
        productLimit: true,
        trialEndsAt: true,
        paidUntil: true,
        lastOrdersSyncAt: true,
        uninstalledAt: true,
        createdAt: true,
        user: { select: { email: true } },
        _count: { select: { listings: true, orders: true } },
      },
    }),
    prisma.shopifyOrder.findMany({
      orderBy: { shopifyCreatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        totalPrice: true,
        currency: true,
        financialStatus: true,
        fulfillmentStatus: true,
        sourcingStatus: true,
        aliCostUsd: true,
        shopifyCreatedAt: true,
        shopifyAccount: { select: { shopDomain: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.shopifyAccount.count(),
    prisma.shopifyAccount.count({ where: { isActive: true } }),
    prisma.shopifyAccount.count({ where: { isActive: false, uninstalledAt: null } }),
    prisma.shopifyAccount.count({ where: { uninstalledAt: { not: null } } }),
    prisma.shopifyListing.count(),
    prisma.shopifyListing.count({ where: { status: "active" } }),
    prisma.shopifyOrder.count(),
    prisma.shopifyOrder.count({ where: { sourcingStatus: "ali_stock_risk" } }),
  ]);

  return NextResponse.json({
    stats: {
      accountsTotal,
      accountsActive,
      accountsFrozen,
      accountsUninstalled,
      listingsTotal,
      listingsActive,
      ordersTotal,
      riskOrders,
    },
    accounts,
    orders,
  });
});
