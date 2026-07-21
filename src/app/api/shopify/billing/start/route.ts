import { NextResponse } from "next/server";
import { SITE } from "@/lib/site";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  isShopifyBillingEnabled,
  getShopifyPlan,
  createAppSubscription,
} from "@/lib/shopify/billing";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().min(1),
  plan: z.string().min(1),
});

/**
 * POST /api/shopify/billing/start — Shopify Billing aboneliği başlatır.
 * Dönen confirmationUrl'e kullanıcı yönlendirilir; onay Shopify admin'de verilir.
 * SHOPIFY_BILLING_ENABLED kapalıyken 503 (fiyatlar sahibin onayını bekliyor).
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!isShopifyBillingEnabled()) {
    return NextResponse.json(
      { error: "Paket satın alma henüz açık değil — canlı destekten bize yaz." },
      { status: 503 }
    );
  }

  const rl = await rateLimitAsync(`shopify-billing:${userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme — biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const plan = getShopifyPlan(parsed.data.plan);
  if (!plan) {
    return NextResponse.json({ error: "Geçersiz paket" }, { status: 400 });
  }

  const account = await prisma.shopifyAccount.findFirst({
    where: { id: parsed.data.accountId, userId },
  });
  if (!account || !account.accessTokenEncrypted) {
    return NextResponse.json(
      { error: "Mağaza bulunamadı veya bağlantısı kopmuş" },
      { status: 404 }
    );
  }

  try {
    // Proxy arkasında req.url origin'i 0.0.0.0:3000'e çözülebiliyor — Shopify'a
    // kayıt edilen dönüş adresi HER ZAMAN sabit site adresinden kurulur.
    const returnUrl = `${SITE.url}/api/shopify/billing/callback?accountId=${account.id}&plan=${plan.id}`;
    const confirmationUrl = await createAppSubscription(
      account.shopDomain,
      decryptToken(account.accessTokenEncrypted),
      plan,
      returnUrl
    );
    return NextResponse.json({ ok: true, confirmationUrl });
  } catch (err) {
    console.error("[shopify/billing/start]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Abonelik başlatılamadı — tekrar dene" },
      { status: 502 }
    );
  }
});
