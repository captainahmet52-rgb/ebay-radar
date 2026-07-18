import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import {
  isShopifyBillingEnabled,
  getShopifyPlan,
  getAppSubscriptionStatus,
} from "@/lib/shopify/billing";

/**
 * GET /api/shopify/billing/callback — Shopify Billing onay dönüşü.
 * Shopify, mağaza sahibi aboneliği onaylayınca charge_id ile buraya yönlendirir.
 * Abonelik durumu Shopify'dan DOĞRULANIR (URL parametresine güvenilmez);
 * ACTIVE ise paket aktive edilir: plan + ürün limiti + 30 gün (+3 gün tolerans).
 */
export async function GET(req: NextRequest) {
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/shopify/stores?billing=${code}`, req.url));

  try {
    if (!isShopifyBillingEnabled()) return fail("disabled");

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId");
    const planId = searchParams.get("plan");
    const chargeId = searchParams.get("charge_id");
    if (!accountId || !planId || !chargeId) return fail("missing_params");

    const plan = getShopifyPlan(planId);
    if (!plan) return fail("bad_plan");

    // Sahiplik: yalnız giriş yapmış hesap sahibi kendi mağazasını aktive edebilir
    const session = await auth();
    if (!session?.user?.id) return fail("auth");

    const account = await prisma.shopifyAccount.findFirst({
      where: { id: accountId, userId: session.user.id },
    });
    if (!account || !account.accessTokenEncrypted) return fail("not_found");

    const status = await getAppSubscriptionStatus(
      account.shopDomain,
      decryptToken(account.accessTokenEncrypted),
      chargeId
    );
    if (status !== "ACTIVE") return fail("not_active");

    await prisma.shopifyAccount.update({
      where: { id: account.id },
      data: {
        isActive: true,
        plan: plan.id,
        productLimit: plan.productLimit,
        paidUntil: new Date(Date.now() + 33 * 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.redirect(new URL("/shopify/stores?billing=ok", req.url));
  } catch (err) {
    console.error("[shopify/billing/callback]", err instanceof Error ? err.message : err);
    return fail("server_error");
  }
}
