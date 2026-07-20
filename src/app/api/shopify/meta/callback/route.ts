import { NextRequest, NextResponse } from "next/server";
import { absoluteUrl, SITE } from "@/lib/site";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { auth } from "@/lib/auth";
import { verifyState, OAUTH_STATE_MAX_AGE_MS } from "@/lib/oauth-state";
import { consumeOnce } from "@/lib/rate-limit";
import {
  isMetaConfigured,
  exchangeCodeForLongLivedToken,
  getAdAccounts,
  getFirstPageId,
} from "@/lib/meta/oauth";

/**
 * GET /api/shopify/meta/callback — Meta OAuth dönüşü.
 * Doğrulama: state (imza+süre+tek kullanım) → oturum eşleşmesi → code'u uzun
 * ömürlü token ile değiştir → ilk reklam hesabını + sayfayı al → MetaAccount kaydet.
 */
export async function GET(req: NextRequest) {
  const fail = (code: string) =>
    NextResponse.redirect(absoluteUrl(`/shopify/meta?error=${code}`));

  try {
    if (!isMetaConfigured()) return fail("not_configured");

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) return fail("missing_params");

    const verified = verifyState(state);
    if (!verified) return fail("invalid_state");
    const fresh = await consumeOnce(`oauth-state:${verified.nonce}`, OAUTH_STATE_MAX_AGE_MS);
    if (!fresh) return fail("state_reused");

    const session = await auth();
    if (!session?.user?.id || session.user.id !== verified.userId) return fail("state_mismatch");
    const userId = verified.userId;

    const shopifyAccountId = verified.region;
    if (!shopifyAccountId) return fail("missing_params");

    const shopifyAccount = await prisma.shopifyAccount.findFirst({
      where: { id: shopifyAccountId, userId },
    });
    if (!shopifyAccount) return fail("not_found");

    const redirectUri = process.env.META_REDIRECT_URI || `${SITE.url}/api/shopify/meta/callback`;
    const { token, expiresAt } = await exchangeCodeForLongLivedToken(code, redirectUri);

    const adAccounts = await getAdAccounts(token);
    if (adAccounts.length === 0) return fail("no_ad_account");
    const primary = adAccounts[0];
    const pageId = await getFirstPageId(token);

    await prisma.metaAccount.upsert({
      where: { shopifyAccountId },
      create: {
        userId,
        shopifyAccountId,
        accessTokenEncrypted: encryptToken(token),
        tokenExpiresAt: expiresAt,
        adAccountId: primary.id,
        businessName: primary.business?.name ?? primary.name,
        pageId,
      },
      update: {
        accessTokenEncrypted: encryptToken(token),
        tokenExpiresAt: expiresAt,
        adAccountId: primary.id,
        businessName: primary.business?.name ?? primary.name,
        pageId,
      },
    });

    return NextResponse.redirect(absoluteUrl("/shopify/meta?connected=1"));
  } catch (err) {
    console.error("[shopify/meta/callback]", err instanceof Error ? err.message : err);
    return fail("server_error");
  }
}
