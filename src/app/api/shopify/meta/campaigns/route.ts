import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { rateLimitAsync } from "@/lib/rate-limit";
import { isMetaConfigured } from "@/lib/meta/oauth";
import { createFullCampaign } from "@/lib/meta/campaigns";
import { ensureProductMedia } from "@/lib/ugc-video/product-media";
import { z } from "zod";

const schema = z.object({
  listingId: z.string().min(1),
  headline: z.string().min(3).max(80),
  primaryText: z.string().min(10),
  dailyBudgetUsd: z.number().min(5).max(500),
  audienceSuggestions: z.array(z.string()).default([]),
});

/**
 * POST /api/shopify/meta/campaigns — AI kampanya taslağından GERÇEK Meta kampanyası
 * oluşturur. Her zaman PAUSED — kullanıcı panelden bilinçli aktive etmeden harcama
 * başlamaz. Görsel: ortak depodaki AI ürün görseli (yoksa orijinal AliExpress görseli).
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!isMetaConfigured()) {
    return NextResponse.json({ error: "Meta entegrasyonu henüz yapılandırılmadı" }, { status: 503 });
  }

  const rl = await rateLimitAsync(`meta-campaign:${userId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla kampanya isteği — biraz sonra tekrar dene." },
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
      product: { select: { title: true, imageUrl: true } },
      shopifyAccount: { select: { id: true, shopDomain: true, metaAccount: true } },
    },
  });
  if (!listing) {
    return NextResponse.json({ error: "Ürün bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }
  const metaAccount = listing.shopifyAccount.metaAccount;
  if (!metaAccount) {
    return NextResponse.json({ error: "Önce bu mağaza için Meta hesabını bağla" }, { status: 400 });
  }
  if (!listing.shopifyProductId) {
    return NextResponse.json({ error: "Ürün henüz Shopify'a yüklenmemiş" }, { status: 400 });
  }

  try {
    const accessToken = decryptToken(metaAccount.accessTokenEncrypted);
    const media = await ensureProductMedia(listing.productId).catch(() => ({
      imageUrls: listing.product.imageUrl ? [listing.product.imageUrl] : [],
    }));
    const imageUrl = media.imageUrls[0] ?? listing.product.imageUrl;
    if (!imageUrl) {
      return NextResponse.json({ error: "Ürünün kullanılabilir görseli yok" }, { status: 400 });
    }

    const numericId = (listing.shopifyProductId ?? "").split("/").pop();
    const linkUrl = `https://${listing.shopifyAccount.shopDomain}/products/${numericId}`;
    const name = `${listing.product.title ?? "Ürün"} — ${new Date().toISOString().slice(0, 10)}`;

    const created = await createFullCampaign(
      {
        adAccountId: metaAccount.adAccountId,
        pageId: metaAccount.pageId,
        name,
        headline: parsed.data.headline,
        primaryText: parsed.data.primaryText,
        linkUrl,
        imageUrl,
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        audienceSuggestions: parsed.data.audienceSuggestions,
      },
      accessToken
    );

    const campaign = await prisma.metaCampaign.create({
      data: {
        userId,
        metaAccountId: metaAccount.id,
        listingId: listing.id,
        metaCampaignId: created.campaignId,
        metaAdSetId: created.adSetId,
        metaAdId: created.adId,
        name,
        status: "PAUSED",
        dailyBudgetUsd: parsed.data.dailyBudgetUsd,
        headline: parsed.data.headline,
        primaryText: parsed.data.primaryText,
      },
    });

    return NextResponse.json({ ok: true, campaign }, { status: 201 });
  } catch (err) {
    console.error("[shopify/meta/campaigns POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: `Kampanya oluşturulamadı: ${err instanceof Error ? err.message : "bilinmeyen hata"}` },
      { status: 502 }
    );
  }
});

/** GET /api/shopify/meta/campaigns — kullanıcının Meta kampanyaları (en yeni önce). */
export const GET = requireAuth(async (_req, { userId }) => {
  const campaigns = await prisma.metaCampaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      status: true,
      dailyBudgetUsd: true,
      headline: true,
      spendUsd: true,
      impressions: true,
      clicks: true,
      lastSyncAt: true,
      lastError: true,
      createdAt: true,
      metaAccount: { select: { adAccountId: true, businessName: true } },
      listing: { select: { product: { select: { title: true, imageUrl: true } } } },
    },
  });
  return NextResponse.json({ campaigns });
});
