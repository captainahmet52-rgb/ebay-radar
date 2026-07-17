import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/api-helpers";
import { signState } from "@/lib/oauth-state";
import { isShopifyConfigured, normalizeShopDomain, buildAuthorizeUrl } from "@/lib/shopify/oauth";

/**
 * GET /api/shopify/connect?shop=magaza.myshopify.com
 * Kullanıcıyı Shopify izin (consent) ekranına yönlendirir.
 * SHOPIFY_APP_KEY/SECRET + SHOPIFY_REDIRECT_URI gerekir — bağlanınca çalışır
 * ("API en sonda" deseni, SP-API connect ile aynı).
 */
export const GET = requireAuth(async (req, { userId }) => {
  if (!isShopifyConfigured() || !process.env.SHOPIFY_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Shopify app yapılandırılmadı (SHOPIFY_APP_KEY / SHOPIFY_APP_SECRET / SHOPIFY_REDIRECT_URI)" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const shopParam = searchParams.get("shop") ?? "";
  const shopDomain = normalizeShopDomain(shopParam);
  if (!shopDomain) {
    return NextResponse.json(
      { error: "Geçersiz mağaza adresi — 'magazan.myshopify.com' formatında olmalı" },
      { status: 400 }
    );
  }

  // CSRF koruması: imzalı + kısa ömürlü state (callback'te doğrulanır + tek kullanım).
  // Mağaza domain'i region alanında taşınır (oauth-state payload'ı yeniden kullanılıyor).
  const nonce = randomBytes(16).toString("hex");
  const state = signState({ userId, nonce, region: shopDomain });

  return NextResponse.redirect(buildAuthorizeUrl(shopDomain, state, process.env.SHOPIFY_REDIRECT_URI));
});
