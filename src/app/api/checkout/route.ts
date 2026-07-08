// POST /api/checkout — bir mağaza için paket satın alma başlatır.
// Gövde: { plan: PlanId, ebayAccountId?: string }
// Dönüş: { url } — kullanıcı bu Lemon Squeezy ödeme sayfasına yönlendirilir.
//
// PAKET = MAĞAZA: ödeme hangi mağaza için alındıysa (ebayAccountId), webhook o
// mağazayı aktive eder. ebayAccountId verilmezse ve kullanıcının TEK mağazası
// varsa o seçilir; birden fazlaysa Mağazalarım'dan seçmesi istenir.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanId } from "@/lib/plans";
import { createCheckoutUrl } from "@/lib/lemonsqueezy";
import { SITE } from "@/lib/site";

const schema = z.object({
  plan: z.string(),
  ebayAccountId: z.string().optional(),
});

export const POST = requireAuth(async (req, { userId }) => {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
    }
    const planDef = getPlan(parsed.data.plan);
    if (!planDef) {
      return NextResponse.json({ error: "Geçersiz paket" }, { status: 400 });
    }

    // Hangi mağaza için? Verilmişse sahipliğini doğrula; yoksa tek mağazayı seç.
    let ebayAccountId = parsed.data.ebayAccountId;
    if (ebayAccountId) {
      const acc = await prisma.ebayAccount.findFirst({
        where: { id: ebayAccountId, userId },
        select: { id: true },
      });
      if (!acc) {
        return NextResponse.json({ error: "Mağaza bulunamadı veya erişim yok" }, { status: 404 });
      }
    } else {
      const accounts = await prisma.ebayAccount.findMany({ where: { userId }, select: { id: true } });
      if (accounts.length === 0) {
        return NextResponse.json({ error: "Önce bir eBay mağazası bağla." }, { status: 400 });
      }
      if (accounts.length > 1) {
        return NextResponse.json(
          {
            error: "Birden fazla mağazan var — hangisi için paket alacağını Mağazalarım'dan seç.",
            needStorePick: true,
          },
          { status: 400 }
        );
      }
      ebayAccountId = accounts[0].id;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

    const url = await createCheckoutUrl({
      planId: parsed.data.plan as PlanId,
      email: user?.email ?? "",
      custom: { ebayAccountId, userId, plan: parsed.data.plan },
      redirectUrl: `${SITE.url}/dashboard/stores?paid=1`,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[checkout POST]", err);
    return NextResponse.json({ error: "Ödeme başlatılamadı" }, { status: 500 });
  }
});
