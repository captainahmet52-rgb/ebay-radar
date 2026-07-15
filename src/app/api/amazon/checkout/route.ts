// POST /api/amazon/checkout — bir Amazon hesabı için paket satın alma başlatır.
// Gövde: { plan: PlanId, amazonAccountId?: string }
// Dönüş: { url } — kullanıcı bu Lemon Squeezy ödeme sayfasına yönlendirilir.
//
// PAKET = HESAP (eBay'deki /api/checkout ile aynı desen): ödeme hangi Amazon
// hesabı için alındıysa (amazonAccountId), webhook o hesabı aktive eder.
// amazonAccountId verilmezse ve kullanıcının TEK hesabı varsa o seçilir; birden
// fazlaysa Mağazalarım'dan seçmesi istenir.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getAmazonPlan, type PlanId } from "@/lib/plans";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { SITE } from "@/lib/site";

const schema = z.object({
  plan: z.string(),
  amazonAccountId: z.string().optional(),
});

export const POST = requireAuth(async (req, { userId }) => {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }
    const planDef = getAmazonPlan(parsed.data.plan);
    if (!planDef) {
      return NextResponse.json({ error: "Geçersiz paket" }, { status: 400 });
    }

    // Hangi hesap için? Verilmişse sahipliğini doğrula; yoksa tek hesabı seç.
    let amazonAccountId = parsed.data.amazonAccountId;
    if (amazonAccountId) {
      const acc = await prisma.amazonAccount.findFirst({
        where: { id: amazonAccountId, userId },
        select: { id: true },
      });
      if (!acc) {
        return NextResponse.json({ error: "Hesap bulunamadı veya erişim yok" }, { status: 404 });
      }
    } else {
      const accounts = await prisma.amazonAccount.findMany({ where: { userId }, select: { id: true } });
      if (accounts.length === 0) {
        return NextResponse.json({ error: "Önce bir Amazon hesabı bağla." }, { status: 400 });
      }
      if (accounts.length > 1) {
        return NextResponse.json(
          {
            error: "Birden fazla hesabın var — hangisi için paket alacağını Mağazalarım'dan seç.",
            needStorePick: true,
          },
          { status: 400 }
        );
      }
      amazonAccountId = accounts[0].id;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    const url = await createCheckoutUrl({
      planId: parsed.data.plan as PlanId,
      email: user?.email ?? "",
      custom: { amazonAccountId, userId, plan: parsed.data.plan },
      redirectUrl: `${SITE.url}/amazon/stores?paid=1`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[amazon/checkout POST]", err);
    return NextResponse.json({ error: "Ödeme başlatılamadı" }, { status: 500 });
  }
});
