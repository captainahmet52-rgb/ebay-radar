import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/crypto";
import { auth } from "@/lib/auth";
import { verifyState, OAUTH_STATE_MAX_AGE_MS } from "@/lib/oauth-state";
import { consumeOnce } from "@/lib/rate-limit";
import { exchangeSpapiCode, getSpapiAccessToken, detectMarketFromParticipations } from "@/lib/amazon-spapi";
import { addDays, STORE_TRIAL_DAYS } from "@/lib/store-access";

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
    return NextResponse.redirect(new URL("/amazon/stores?error=missing_params", req.url));
  }

  // CSRF: state imzalı + kısa ömürlü olmalı. Geçersiz/expired ise reddet.
  const verified = verifyState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/amazon/stores?error=invalid_state", req.url));
  }

  // TEK KULLANIM: aynı state (nonce) ikinci kez oynatılamaz — çalınmış state'in
  // 10 dakikalık pencere içinde tekrar kullanılmasını (replay) engeller.
  const fresh = await consumeOnce(`oauth-state:${verified.nonce}`, OAUTH_STATE_MAX_AGE_MS);
  if (!fresh) {
    return NextResponse.redirect(new URL("/amazon/stores?error=state_reused", req.url));
  }

  const region = verified.region === "eu" ? "eu" : "na";

  // GÜVENLİK: Hesap bağlamayı yalnız GİRİŞ YAPMIŞ ve state'teki userId ile EŞLEŞEN
  // kullanıcıya izin ver. Oturum yoksa veya farklıysa reddet (state replay koruması).
  const session = await auth();
  if (!session?.user?.id || session.user.id !== verified.userId) {
    return NextResponse.redirect(new URL("/amazon/stores?error=state_mismatch", req.url));
  }
  const userId = verified.userId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, amazonTrialEndsAt: true },
  });
  if (!user) {
    return NextResponse.redirect(new URL("/amazon/stores?error=invalid_state", req.url));
  }

  const redirectUri = process.env.AMAZON_SPAPI_REDIRECT_URI ?? "";
  const resolvedSellerId = sellerId ?? "unknown";

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

    // ── Bedava deneme uygunluğu (eBay'deki EbayTrialHistory ile AYNI desen,
    // ama eBay'den BAĞIMSIZ — iki farklı ürün, her biri kendi denemesini hak eder) ──
    //   (1) KULLANICI ömür boyu 1 deneme — User.amazonTrialEndsAt bir kez set edilir.
    //   (2) Her Amazon SATICI HESABI (immutable sellerId) GLOBAL 1 kez.
    const userHadTrial = !!user.amazonTrialEndsAt;
    let sellerTrialUsed = false;
    if (!userHadTrial && resolvedSellerId !== "unknown") {
      sellerTrialUsed = !!(await prisma.amazonTrialHistory.findUnique({
        where: { sellerId: resolvedSellerId },
        select: { id: true },
      }));
    }
    const trialGranted = !userHadTrial && !sellerTrialUsed;
    const trialEnd = trialGranted ? addDays(new Date(), STORE_TRIAL_DAYS) : null;

    // 3. Hesabı kaydet (token şifreli) — deneme hak ediyorsa AKTİF gelir.
    await prisma.amazonAccount.create({
      data: {
        userId,
        sellerId: resolvedSellerId,
        market,
        spapiRefreshTokenEncrypted: encryptToken(refreshToken),
        isActive: trialGranted,
        activatedAt: trialGranted ? new Date() : null,
        trialEndsAt: trialEnd,
      },
    });

    if (trialGranted) {
      await prisma.user.update({ where: { id: userId }, data: { amazonTrialEndsAt: trialEnd } });
      if (resolvedSellerId !== "unknown") {
        try {
          await prisma.amazonTrialHistory.create({ data: { sellerId: resolvedSellerId, userId } });
        } catch (err) {
          // P2002 (eşzamanlı bağlanma araya girdi) → kayıt zaten var, sorun değil.
          console.error("[amazon/callback] trial history kaydı atlandı (zaten var olabilir):", err);
        }
      }
    }

    return NextResponse.redirect(new URL("/amazon/stores?success=amazon_connected", req.url));
  } catch (err) {
    console.error("[amazon/callback]", err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL("/amazon/stores?error=connect_failed", req.url));
  }
}
