import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signState } from "@/lib/oauth-state";
import { isMetaConfigured, buildAuthorizeUrl } from "@/lib/meta/oauth";
import { randomBytes } from "crypto";

/**
 * GET /api/shopify/meta/connect?accountId=xxx — Meta OAuth başlatır.
 * state.region = shopifyAccountId (Shopify OAuth ile aynı desen).
 */
export async function GET(req: NextRequest) {
  if (!isMetaConfigured()) {
    return NextResponse.json({ error: "Meta entegrasyonu henüz yapılandırılmadı" }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.redirect(new URL("/shopify/meta?error=missing_params", req.url));
  }

  const account = await prisma.shopifyAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.redirect(new URL("/shopify/meta?error=not_found", req.url));
  }

  const state = signState({ userId: session.user.id, nonce: randomBytes(16).toString("hex"), region: accountId });
  const origin = new URL(req.url).origin;
  const redirectUri = process.env.META_REDIRECT_URI || `${origin}/api/shopify/meta/callback`;
  const authorizeUrl = buildAuthorizeUrl(state, redirectUri);

  return NextResponse.redirect(authorizeUrl);
}
