import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/ebay/oauth";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { verifyState } from "@/lib/oauth-state";
import { normalizeEbayMarketplaceId } from "@/lib/ebay-markets";
import { addDays, STORE_TRIAL_DAYS } from "@/lib/store-access";
import { REFERRAL_MAX_BONUS_PER_STORE } from "@/lib/referral";
import { listingImportQueue } from "@/lib/queues";

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
    const state = searchParams.get("state"); // imzalı state

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=missing_params", req.url)
      );
    }

    // CSRF: state imzalı + kısa ömürlü olmalı. Geçersiz/expired ise reddet.
    const verified = verifyState(state);
    if (!verified) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=invalid_state", req.url)
      );
    }

    // Hesabı bağlayacağımız userId DAİMA mevcut oturumdan gelir; state yalnız
    // CSRF koruması içindir. Oturum yoksa veya state ile eşleşmiyorsa reddet.
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=not_authenticated", req.url)
      );
    }
    if (session.user.id !== verified.userId) {
      return NextResponse.redirect(
        new URL("/dashboard/settings?error=state_mismatch", req.url)
      );
    }
    const ownerUserId = session.user.id;

    // Kullanıcı var mı?
    const user = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { id: true, trialEndsAt: true, referralRewardDays: true },
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

    // ── Bedava deneme uygunluğu (suistimal koruması) ──────────────────────────
    // İKİ kural birden:
    //   (1) KULLANICI ömür boyu 1 deneme — user.trialEndsAt bir kez set edilir, asla
    //       sıfırlanmaz; ikinci mağaza bedava deneme ALAMAZ.
    //   (2) Her eBay MAĞAZASI (immutable ebayUserId) GLOBAL 1 kez — EbayTrialHistory'de
    //       kaydı varsa, başka bir hesaba bağlansa bile bedava deneme YOK.
    // İhlalde: mağaza DONDURULMUŞ başlar (isActive=false, trialEndsAt=null); kullanıcı
    // paket alıp /activate ile açabilir. Böylece "hesap aç → bedava → tekrar" döngüsü kapanır.
    const userHadTrial = !!user.trialEndsAt;
    let ebayTrialUsed = false;
    if (!userHadTrial) {
      ebayTrialUsed = !!(await prisma.ebayTrialHistory.findUnique({
        where: { ebayUserId: identity.userId },
        select: { id: true },
      }));
    }
    const trialGranted = !userHadTrial && !ebayTrialUsed;

    // Deneme verilecekse davet ödülü günleri denemeye eklenir (mağaza başına azami sınır).
    const bonusDays = trialGranted
      ? Math.min(user.referralRewardDays ?? 0, REFERRAL_MAX_BONUS_PER_STORE)
      : 0;
    const trialEnd = trialGranted ? addDays(new Date(), STORE_TRIAL_DAYS + bonusDays) : null;

    const account = await prisma.ebayAccount.create({
      data: {
        userId: ownerUserId,
        ebayUserId: identity.userId,
        marketplace: identity.marketplace, // pazar otomatik tespit edildi
        oauthTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        isActive: trialGranted,
        activatedAt: trialGranted ? new Date() : null,
        trialEndsAt: trialEnd,
      },
    });

    if (trialGranted) {
      // Denemeyi "tüketildi" işaretle: kullanıcı ömür-boyu bayrağı (trialEndsAt) +
      // bu eBay mağazasını global geçmişe yaz. Davet ödülü günlerini bakiyeden düş.
      await prisma.user.update({
        where: { id: ownerUserId },
        data: {
          trialEndsAt: trialEnd,
          ...(bonusDays > 0 ? { referralRewardDays: { decrement: bonusDays } } : {}),
        },
      });
      try {
        await prisma.ebayTrialHistory.create({
          data: { ebayUserId: identity.userId, userId: ownerUserId },
        });
      } catch (err) {
        // P2002 (eşzamanlı bağlanma araya girdi) → kayıt zaten var, sorun değil.
        console.error("[ebay/callback] trial history kaydı atlandı (zaten var olabilir):", err);
      }
    }

    // Mağaza bağlanır bağlanmaz mevcut eBay ilanlarını OTOMATİK çek (KEŞİF fazı).
    // ÜCRETSİZ: yalnızca eBay'den çeker + SKU'daki ASIN'i sınıflar; scraper/Amazon YOK,
    // takip/fiyatlama BAŞLAMAZ (gölge modu — kullanıcı "takibi aç" diyene kadar dokunulmaz).
    // Hata olursa bağlama akışını BOZMA (yalnız logla, kullanıcı yine de bağlanmış olur).
    try {
      const imp = await prisma.listingImport.create({
        data: {
          userId: ownerUserId,
          ebayAccountId: account.id,
          status: "pending",
          source: "getmyebayselling",
        },
      });
      await listingImportQueue.add(
        "listing-import",
        { importId: imp.id },
        { jobId: `listing-import:${imp.id}` }
      );
    } catch (err) {
      console.error("[ebay/callback] otomatik ilan içe aktarma başlatılamadı:", err);
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
