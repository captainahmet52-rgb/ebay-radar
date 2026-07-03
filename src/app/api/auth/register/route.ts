import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureReferralCode, REFERRAL_REWARD_DAYS } from "@/lib/referral";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Brute-force / kötüye kullanım koruması — IP başına kalıcı (Redis) pencere.
  const ip = getClientIp(req);
  const limit = await rateLimitAsync(`register:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla deneme. Lütfen daha sonra tekrar deneyin." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  try {
    const body = await req.json() as { email?: string; password?: string; referralCode?: string };
    const { email, password } = body;
    const referralCode = body.referralCode?.trim().toUpperCase();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre zorunludur" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter olmalıdır" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Geçersiz e-posta adresi" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Davet kodu geçerli mi? (varsa daveti eden kullanıcıyı bul)
    const referrer = referralCode
      ? await prisma.user.findUnique({ where: { referralCode }, select: { id: true } })
      : null;

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        plan: "free",
        // Davetle gelen yeni kullanıcıya hoş geldin bonusu
        ...(referrer
          ? { referredById: referrer.id, referralRewardDays: REFERRAL_REWARD_DAYS }
          : {}),
      },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });

    // Yeni kullanıcıya benzersiz davet kodu üret
    await ensureReferralCode(user.id);

    // Daveti edene de ödül günü ekle
    if (referrer) {
      await prisma.user.update({
        where: { id: referrer.id },
        data: { referralRewardDays: { increment: REFERRAL_REWARD_DAYS } },
      });
    }

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const error = err as { code?: string };
    // Prisma unique constraint ihlali
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Bu e-posta adresi zaten kayıtlı" },
        { status: 409 }
      );
    }
    // LOG HİJYENİ: ham hata objesini basma (istek gövdesi/e-posta PII sızabilir) —
    // yalnız hata mesajını/kodunu logla.
    console.error("[register] hata:", err instanceof Error ? err.message : "bilinmeyen");
    return NextResponse.json(
      { error: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
