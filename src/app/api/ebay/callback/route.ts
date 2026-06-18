import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/ebay/oauth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { normalizeEbayMarketplaceId } from "@/lib/ebay-markets";

// getApiBaseUrl is used to build the Identity API URL.
// isSandbox / getApiBaseUrl are module-private in oauth.ts so we read the
// same env variable directly here instead of duplicating the export.
function getIdentityApiBaseUrl(): string {
  return process.env.EBAY_SANDBOX === "true"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";
}

/**
 * Fetches the immutable eBay userId from the Commerce Identity API.
 * commerce.identity.readonly scope must be included in the OAuth grant.
 * The access token is never logged.
 *
 * @throws Error when the HTTP call fails or the response is missing userId.
 */
interface EbayIdentity {
  userId: string;
  /** Pazar tespiti — desteklenen anahtar (EBAY_US/GB/DE/AU); bilinmiyorsa EBAY_US. */
  marketplace: string;
}

async function fetchEbayIdentity(accessToken: string): Promise<EbayIdentity> {
  const url = `${getIdentityApiBaseUrl()}/commerce/identity/v1/user/`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      // Do not log this header — it contains the bearer token.
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    // Log the status only, never the token or raw body.
    console.error(
      "[ebay/callback] Identity API döndürdü:",
      response.status,
      response.statusText
    );
    throw new Error(
      `eBay Identity API hatası: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    userId?: string;
    registrationMarketplaceId?: string;
  };

  if (!data.userId) {
    console.error("[ebay/callback] Identity API yanıtında userId alanı yok");
    throw new Error("eBay Identity API yanıtında userId alanı bulunamadı");
  }

  return {
    userId: data.userId,
    marketplace: normalizeEbayMarketplaceId(data.registrationMarketplaceId),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // state = userId

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=missing_params", req.url)
      );
    }

    // Kullanıcı var mı?
    const user = await prisma.user.findUnique({
      where: { id: state },
      select: { id: true, trialEndsAt: true },
    });
    if (!user) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=invalid_state", req.url)
      );
    }

    // Code → tokens
    let tokens;
    try {
      tokens = await exchangeCodeForTokens(code);
    } catch (err) {
      console.error("[ebay/callback] Token değişimi başarısız:", err);
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=token_exchange", req.url)
      );
    }

    // eBay Identity API'den gerçek (immutable) kullanıcı ID'sini + pazarı al.
    // Başarısız olursa DB'ye yazmadan yönlendir.
    let identity: EbayIdentity;
    try {
      identity = await fetchEbayIdentity(tokens.accessToken);
    } catch (err) {
      console.error("[ebay/callback] Identity fetch başarısız:", err);
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=identity_fetch", req.url)
      );
    }

    // Token'ları şifrele — düz metin DB'ye asla yazılmaz.
    const oauthTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = encryptToken(tokens.refreshToken);
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    await prisma.ebayAccount.create({
      data: {
        userId: state,
        ebayUserId: identity.userId,
        marketplace: identity.marketplace, // pazar otomatik tespit edildi
        oauthTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
      },
    });

    // İlk mağaza bağlandıysa trial başlat
    if (!user.trialEndsAt) {
      const accountCount = await prisma.ebayAccount.count({ where: { userId: state } });
      if (accountCount === 1) {
        await prisma.user.update({
          where: { id: state },
          data: { trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
      }
    }

    return NextResponse.redirect(
      new URL("/dashboard/settings?success=ebay_connected", req.url)
    );
  } catch (err) {
    console.error("[ebay/callback GET]", err);
    return NextResponse.redirect(
      new URL("/dashboard/settings?error=server_error", req.url)
    );
  }
}
