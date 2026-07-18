import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { isShopifyConfigured } from "@/lib/shopify/oauth";
import { isShopifyBillingEnabled, SHOPIFY_PLANS } from "@/lib/shopify/billing";
import { storeAccessState, trialDaysLeft } from "@/lib/store-access";

/**
 * GET /api/shopify/accounts — kullanıcının bağlı Shopify mağazaları
 * (erişim durumu + listeleme sayılarıyla). Token asla dönmez.
 */
export const GET = requireAuth(async (_req, { userId }) => {
  const accounts = await prisma.shopifyAccount.findMany({
    where: { userId },
    select: {
      id: true,
      shopDomain: true,
      isActive: true,
      trialEndsAt: true,
      paidUntil: true,
      plan: true,
      productLimit: true,
      metaPixelId: true,
      feedToken: true,
      createdAt: true,
      _count: { select: { listings: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    configured: isShopifyConfigured(),
    // Billing kapalıyken planlar UI'da GÖSTERİLMEZ (taslak fiyatlar sızmasın)
    billingEnabled: isShopifyBillingEnabled(),
    plans: isShopifyBillingEnabled() ? SHOPIFY_PLANS : [],
    accounts: accounts.map((a) => ({
      ...a,
      accessState: storeAccessState(a),
      trialDaysLeft: trialDaysLeft(a.trialEndsAt),
      listingCount: a._count.listings,
    })),
  });
});
