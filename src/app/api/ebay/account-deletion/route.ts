import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

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
  // eBay bildirimleri x-ebay-signature ile imzalar. Tam ECDSA imza doğrulaması
  // eBay'in public key'ini çekmeyi gerektirir; o kurulmadan paylaşılan
  // doğrulama token'ı (panelde girilen, .env'deki EBAY_DELETION_VERIFICATION_TOKEN)
  // ile gerçeklik kapısı koruyoruz. Token eşleşmezse: silme YAPMA, sadece 200 dön.
  try {
    const token = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
    const signature = req.headers.get("x-ebay-signature");
    const verified = Boolean(token) && signature === token;

    const body = (await req.json().catch(() => null)) as {
      notification?: { data?: { username?: string; userId?: string } };
    } | null;
    const username = body?.notification?.data?.username;
    const ebayUserId = body?.notification?.data?.userId;
    console.log(
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
