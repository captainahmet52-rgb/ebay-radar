import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { auth } from "@/lib/auth";
import { verifyState } from "@/lib/oauth-state";
import { exchangeSpapiCode, getSpapiAccessToken, detectMarketFromParticipations } from "@/lib/amazon-spapi";

/**
 * GET /api/amazon/callback
 * SP-API yetkilendirme dönüşü: spapi_oauth_code → refresh token → pazar tespiti → AmazonAccount.
 * Amazon, dönüşte spapi_oauth_code + selling_partner_id + state gönderir.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("spapi_oauth_code");
  const sellerId = searchParams.get("selling_partner_id");
  const state = searchParams.get("state"); // imzalı state (userId + region)

  if (!code || !state) {
    return NextResponse.redirect(new URL("/amazon/settings?error=missing_params", req.url));
  }

  // CSRF: state imzalı + kısa ömürlü olmalı. Geçersiz/expired ise reddet.
  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/amazon/settings?error=invalid_state", req.url));
  }

  const region = verified.region === "eu" ? "eu" : "na";

  // GÜVENLİK: Hesap bağlamayı yalnız GİRİŞ YAPMIŞ ve state'teki userId ile EŞLEŞEN
  // kullanıcıya izin ver. Oturum yoksa veya farklıysa reddet (state replay koruması).
  const session = await auth();
  if (!session?.user?.id || session.user.id !== verified.userId) {
    return NextResponse.redirect(new URL("/amazon/settings?error=state_mismatch", req.url));
  }
  const userId = verified.userId;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.redirect(new URL("/amazon/settings?error=invalid_state", req.url));
  }

  const redirectUri = process.env.AMAZON_SPAPI_REDIRECT_URI ?? "";

  try {
    // 1. Kod → kalıcı refresh token
    const refreshToken = await exchangeSpapiCode(code, redirectUri);

    // 2. Pazarı otomatik tespit et (getMarketplaceParticipations)
    let market = region === "eu" ? "uk" : "us";
    try {
      const { accessToken } = await getSpapiAccessToken(refreshToken);
      market = await detectMarketFromParticipations(region, accessToken);
    } catch {
      // tespit başarısızsa bölgenin varsayılan pazarı kullanılır
    }

    // 3. Hesabı kaydet (token şifreli)
    await prisma.amazonAccount.create({
      data: {
        userId,
        sellerId: sellerId ?? "unknown",
        market,
        spapiRefreshTokenEncrypted: encryptToken(refreshToken),
      },
    });

    return NextResponse.redirect(new URL("/amazon/settings?success=amazon_connected", req.url));
  } catch (err) {
    console.error("[amazon/callback]", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/amazon/settings?error=connect_failed", req.url));
  }
}
