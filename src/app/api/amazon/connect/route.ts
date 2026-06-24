import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { requireAuth } from "@/lib/api-helpers";
import { signState } from "@/lib/oauth-state";

/**
 * GET /api/amazon/connect?region=na|eu
 * Kullanıcıyı Amazon SP-API yetkilendirme (consent) sayfasına yönlendirir.
 * SP-API app (AMAZON_SPAPI_APP_ID) + redirect URI gerekir — bağlanınca çalışır.
 */
export const GET = requireAuth(async (req, { userId }) => {
  const appId = process.env.AMAZON_SPAPI_APP_ID;
  const redirectUri = process.env.AMAZON_SPAPI_REDIRECT_URI;

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "SP-API app yapılandırılmadı (AMAZON_SPAPI_APP_ID / AMAZON_SPAPI_REDIRECT_URI)" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const region = (searchParams.get("region") ?? "na").toLowerCase() === "eu" ? "eu" : "na";

  // CSRF koruması: ham userId:region değil, imzalı + kısa ömürlü state.
  // Bölge bilgisi callback'te pazar tespiti için payload'da taşınır.
  const nonce = randomBytes(16).toString("hex");
  const state = signState({ userId, nonce, region });
  const consentBase =
    region === "eu"
      ? "https://sellercentral-europe.amazon.com/apps/authorize/consent"
      : "https://sellercentral.amazon.com/apps/authorize/consent";

  const url = `${consentBase}?application_id=${encodeURIComponent(appId)}&state=${encodeURIComponent(
    state
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&version=beta`;

  return NextResponse.redirect(url);
});
