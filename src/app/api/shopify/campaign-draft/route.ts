import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  isCampaignDraftConfigured,
  generateCampaignDraft,
} from "@/lib/campaign-draft";
import { z } from "zod";

const schema = z.object({ listingId: z.string().min(1) });

/**
 * POST /api/shopify/campaign-draft — kullanıcının yüklediği ürün için AI Meta
 * kampanya taslağı (araştırma + metin, Haiku). Kullanıcı taslağı kopyalayıp
 * Meta Ads Manager'a yapıştırır (tam API entegrasyonu Faz 3 — şirket sonrası).
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!isCampaignDraftConfigured()) {
    return NextResponse.json(
      { error: "AI kampanya taslağı henüz yapılandırılmadı (ANTHROPIC_API_KEY)" },
      { status: 503 }
    );
  }

  // AI maliyet freni: kullanıcı başına saatte 20 taslak fazlasıyla yeter
  const rl = await rateLimitAsync(`campaign-draft:${userId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla taslak istedin — biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const listing = await prisma.shopifyListing.findFirst({
    where: { id: parsed.data.listingId, userId },
    include: {
      product: { select: { title: true, category: true, aliRating: true, aliOrders: true } },
      shopifyAccount: { select: { shopDomain: true } },
    },
  });
  if (!listing) {
    return NextResponse.json({ error: "Ürün bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }

  try {
    const draft = await generateCampaignDraft({
      title: listing.product.title ?? "Ürün",
      category: listing.product.category,
      salePriceUsd: listing.salePrice ?? 0,
      aliRating: listing.product.aliRating,
      aliOrders: listing.product.aliOrders,
      shopDomain: listing.shopifyAccount.shopDomain,
    });
    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    console.error("[shopify/campaign-draft]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Taslak üretilemedi — tekrar dene" },
      { status: 502 }
    );
  }
});
