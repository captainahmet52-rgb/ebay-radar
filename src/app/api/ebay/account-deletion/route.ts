import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import {
  verifyEbayNotificationSignature,
  looksLikeEbaySignature,
} from "@/lib/ebay/notification-verify";

/** Sabit-zamanlı string karşılaştırma — uzunluk farkını da güvenli ele alır. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * eBay Marketplace Account Deletion / Closure Notification endpoint.
 * Production anahtarlarını aktif etmek için ZORUNLU (eBay gizlilik gereği).
 *
 * GET: eBay doğrulama — ?challenge_code=XXX gelir; yanıt:
 *   challengeResponse = SHA256(challengeCode + verificationToken + endpoint)
 * POST: kullanıcı veri silme bildirimi gelir → 200 dönülür (ve ilgili eBay verisi silinir).
 *
 * eBay panelinde "Verification token" ve bu endpoint URL'i girilir; aynı değerler .env'de olmalı:
 *   EBAY_DELETION_VERIFICATION_TOKEN, EBAY_DELETION_ENDPOINT
 */

const ENDPOINT =
  process.env.EBAY_DELETION_ENDPOINT ?? "https://leanautomation.pro/api/ebay/account-deletion";

export async function GET(req: NextRequest) {
  const challengeCode = new URL(req.url).searchParams.get("challenge_code");
  const token = process.env.EBAY_DELETION_VERIFICATION_TOKEN;

  if (!token) {
    return NextResponse.json({ error: "verification token yapılandırılmadı" }, { status: 500 });
  }
  if (!challengeCode) {
    return NextResponse.json({ error: "challenge_code yok" }, { status: 400 });
  }

  // eBay'in beklediği sıra: challengeCode + verificationToken + endpoint
  const hash = createHash("sha256")
    .update(challengeCode)
    .update(token)
    .update(ENDPOINT)
    .digest("hex");

  return NextResponse.json({ challengeResponse: hash }, { status: 200 });
}

export async function POST(req: NextRequest) {
  // Kullanıcı hesap silme bildirimi — eBay 200/204 bekler.
  //
  // GÜVENLİK: Bu uç doğrulanmamış (unauthenticated) istemcilere açıktır.
  // Bildirimin gerçekliği DOĞRULANMADAN ASLA yıkıcı silme yapılmaz —
  // aksi halde herkes POST atıp eBay hesap kayıtlarını silebilir.
  //
  // Gerçek eBay bildirimleri x-ebay-signature'ı Base64-JSON (kid + ECDSA imza)
  // olarak gönderir → verifyEbayNotificationSignature ile HAM gövde üzerinde
  // doğrulanır. Düz token eşitliği yalnızca manuel test için yedek yol.
  try {
    const signature = req.headers.get("x-ebay-signature");
    const rawBody = await req.text().catch(() => "");

    let verified = false;
    if (looksLikeEbaySignature(signature)) {
      verified = await verifyEbayNotificationSignature(rawBody, signature);
    } else {
      // Yedek yol (manuel test): düz token eşitliği
      const token = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
      verified = Boolean(token) && Boolean(signature) && safeEqual(signature!, token!);
    }

    const body = (rawBody ? JSON.parse(rawBody) : null) as {
      notification?: { data?: { username?: string; userId?: string } };
    } | null;
    const username = body?.notification?.data?.username;
    const ebayUserId = body?.notification?.data?.userId;
    console.info(
      "[ebay-deletion] Silme bildirimi:",
      username ?? ebayUserId ?? "bilinmiyor",
      verified ? "(doğrulandı)" : "(DOĞRULANMADI — silme atlandı)"
    );

    // Yalnızca doğrulanmış bildirimlerde yıkıcı silme yapılır.
    if (verified && ebayUserId) {
      const { prisma } = await import("@/lib/prisma");
      await prisma.ebayAccount.deleteMany({ where: { ebayUserId } }).catch(() => {});
    }
  } catch {
    // gövde parse edilemese de eBay'e 200 dönmeliyiz
  }
  // eBay her durumda 200/204 bekler — doğrulanmamış istek de sessizce ack edilir.
  return new NextResponse(null, { status: 200 });
}
