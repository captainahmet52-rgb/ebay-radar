import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { auth } from "@/lib/auth";
import { verifyState, OAUTH_STATE_MAX_AGE_MS } from "@/lib/oauth-state";
import { consumeOnce } from "@/lib/rate-limit";
import {
  isShopifyConfigured,
  normalizeShopDomain,
  verifyCallbackHmac,
  exchangeCodeForToken,
} from "@/lib/shopify/oauth";
import { addDays, STORE_TRIAL_DAYS, STORE_TRIAL_PRODUCT_LIMIT } from "@/lib/store-access";
import { registerShopifyWebhooks } from "@/lib/shopify/webhooks";

/**
 * GET /api/shopify/callback — Shopify OAuth dönüşü.
 * Doğrulama zinciri: HMAC (Shopify imzası) → state (imza + süre + tek kullanım)
 * → oturum eşleşmesi → code'u kalıcı access token ile değiştir → ShopifyAccount
 * kaydet (token ŞİFRELİ). Bağlanan mağaza 7 günlük deneme ile aktif başlar;
 * shopDomain global tekil olduğu için aynı mağaza ikinci kez deneme alamaz.
 */
export async function GET(req: NextRequest) {
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/shopify/stores?error=${code}`, req.url));

  try {
    if (!isShopifyConfigured()) return fail("not_configured");

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const shopParam = searchParams.get("shop");

    if (!code || !state || !shopParam) return fail("missing_params");

    // 1. Shopify HMAC imzası (query bütünlüğü)
    if (!verifyCallbackHmac(searchParams)) return fail("bad_hmac");

    // 2. CSRF state: imza + süre + TEK KULLANIM
    const verified = verifyState(state);
    if (!verified) return fail("invalid_state");
    const fresh = await consumeOnce(`oauth-state:${verified.nonce}`, OAUTH_STATE_MAX_AGE_MS);
    if (!fresh) return fail("state_reused");

    // 3. Oturum eşleşmesi (hesap yalnız giriş yapmış sahibine bağlanır)
    const session = await auth();
    if (!session?.user?.id || session.user.id !== verified.userId) return fail("state_mismatch");
    const userId = verified.userId;

    // 4. Mağaza domain'i: hem Shopify'ın gönderdiği hem state'te taşıdığımız
    // değer doğrulanır ve AYNI olmalı (mağaza değiştirme oyununu engeller)
    const shopDomain = normalizeShopDomain(shopParam);
    if (!shopDomain || shopDomain !== verified.region) return fail("shop_mismatch");

    // 5. Token değişimi + şifreli kayıt
    const accessToken = await exchangeCodeForToken(shopDomain, code);

    const existing = await prisma.shopifyAccount.findUnique({ where: { shopDomain } });
    if (existing) {
      if (existing.userId !== userId) return fail("shop_owned_by_other");
      // Yeniden bağlanma: token tazele, deneme hakkı YENİDEN VERİLMEZ.
      // Uygulama yeniden kurulduysa uninstall damgası da temizlenir.
      await prisma.shopifyAccount.update({
        where: { id: existing.id },
        data: { accessTokenEncrypted: encryptToken(accessToken), uninstalledAt: null },
      });
    } else {
      const now = new Date();
      await prisma.shopifyAccount.create({
        data: {
          userId,
          shopDomain,
          accessTokenEncrypted: encryptToken(accessToken),
          isActive: true,
          activatedAt: now,
          trialEndsAt: addDays(now, STORE_TRIAL_DAYS),
          productLimit: STORE_TRIAL_PRODUCT_LIMIT,
        },
      });
    }

    // 6. Webhook abonelikleri (app/uninstalled + abonelik durumu) — best-effort:
    // başarısız olsa bile bağlantı tamamdır (siparişler polling ile zaten çekilir)
    await registerShopifyWebhooks(shopDomain, accessToken, new URL(req.url).origin);

    return NextResponse.redirect(new URL("/shopify/stores?connected=1", req.url));
  } catch (err) {
    console.error("[shopify/callback]", err instanceof Error ? err.message : err);
    return fail("server_error");
  }
}
