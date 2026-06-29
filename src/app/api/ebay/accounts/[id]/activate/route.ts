import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { addDays, STORE_SUBSCRIPTION_DAYS, storeAccessState } from "@/lib/store-access";
import { enqueueVerificationForAccount } from "@/lib/ebay/listing-import";

/**
 * Mağaza aktifleştirme. PAKET = MAĞAZA: her eBay mağazası KENDİ aboneliğine sahiptir.
 * Aktivasyon yalnızca ödeme ile yapılır; aktif edilen mağazaya o paketin ürün limiti
 * yazılır. 1 abonelik = 1 mağaza — ek mağaza için ayrı abonelik gerekir.
 * Sadece aktif mağazalara ürün yüklenir / radar çalışır.
 */
export const POST = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;

    // Bu mağaza için seçilen paket (opsiyonel; Paddle checkout ileride gönderecek).
    const body = await req.json().catch(() => null);
    const requestedPlan =
      body && typeof body.plan === "string" && getPlan(body.plan) ? body.plan : undefined;

    const account = await prisma.ebayAccount.findFirst({ where: { id, userId } });
    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    // Zaten deneme/ücretli erişimi varsa tekrar ödemeye gerek yok
    if (account.isActive && storeAccessState(account) !== "frozen") {
      return NextResponse.json({ success: true, alreadyActive: true });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, stripeSubscriptionId: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    // PAKET = MAĞAZA: aktivasyon yalnızca ÖDEME ile yapılır (Paddle checkout buraya
    // bağlanacak). Deneme, ek mağaza aktivasyonu hakkı VERMEZ. Abonelik yoksa paket
    // sayfasına yönlendirilir.
    if (!user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Bu mağazayı aktifleştirmek için bir paket satın almanız gerekiyor.", needUpgrade: true },
        { status: 402 }
      );
    }

    // Bu mağazanın paketi + o pakete ait ürün limiti (mağaza-başına).
    const storePlan = requestedPlan ?? user.plan ?? "starter";
    const planDef = getPlan(storePlan);
    const storeLimit = planDef?.storeLimit ?? 1; // her abonelik = 1 mağaza
    const now = new Date();

    // 1 abonelik = 1 mağaza: bu aboneliğe bağlı zaten ücretli aktif başka mağaza varsa
    // yeni mağaza için ayrı abonelik gerekir.
    const paidActiveCount = await prisma.ebayAccount.count({
      where: { userId, paidUntil: { gt: now }, NOT: { id } },
    });
    if (paidActiveCount >= storeLimit) {
      return NextResponse.json(
        {
          error: "Her eBay mağazası için ayrı bir abonelik gerekir. Bu mağaza için yeni bir paket satın alın.",
          needUpgrade: true,
          activeCount: paidActiveCount,
          limit: storeLimit,
        },
        { status: 402 }
      );
    }

    await prisma.ebayAccount.update({
      where: { id },
      data: {
        isActive: true,
        activatedAt: now,
        paidUntil: addDays(now, STORE_SUBSCRIPTION_DAYS),
        plan: storePlan,
        productLimit: planDef?.productLimit ?? 300,
      },
    });

    // Mağaza artık ücretli aktif → bağlanışta frozen olduğu için ATLANMIŞ olabilecek ilan
    // doğrulamasını şimdi tetikle (içe aktarılmış "pending" ilanlar takibe alınır).
    // Hata olursa aktivasyonu BOZMA (yalnız logla — kullanıcı parayı verdi, mağaza açıldı).
    try {
      await enqueueVerificationForAccount(id);
    } catch (err) {
      console.error("[ebay/accounts/[id]/activate] verify tetikleme atlandı:", err);
    }

    return NextResponse.json({
      success: true,
      activeCount: paidActiveCount + 1,
      limit: storeLimit,
      plan: storePlan,
    });
  } catch (err) {
    console.error("[ebay/accounts/[id]/activate POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

/** Mağaza pasifleştirme (limitten düşürür, başka mağaza aktif edilebilir). */
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  try {
    const { id } = await params;
    const account = await prisma.ebayAccount.findFirst({ where: { id, userId } });
    if (!account) {
      return NextResponse.json(
        { error: "eBay hesabı bulunamadı veya erişim yetkiniz yok" },
        { status: 404 }
      );
    }

    await prisma.ebayAccount.update({
      where: { id },
      data: { isActive: false, activatedAt: null, paidUntil: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[ebay/accounts/[id]/activate DELETE]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
