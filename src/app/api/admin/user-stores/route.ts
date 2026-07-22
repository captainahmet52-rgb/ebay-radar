import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COMP_UNTIL } from "@/lib/store-access";
import { getPlan, PLANS, type PlanId } from "@/lib/plans";
import { z } from "zod";

// Admin bir plan seçmezse (ör. eski istemci) geriye dönük varsayılan — en üst limit.
const DEFAULT_COMP_PLAN: PlanId = "enterprise";
const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];

/**
 * GET /api/admin/user-stores
 * Tüm kullanıcıların bağlı eBay mağazalarını listeler (admin görünümü).
 * Token alanları ASLA döndürülmez.
 */
export const GET = requireAdmin(async () => {
  const accounts = await prisma.ebayAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ebayUserId: true,
      marketplace: true,
      isActive: true,
      activatedAt: true,
      trialEndsAt: true,
      paidUntil: true,
      createdAt: true,
      plan: true,
      productLimit: true,
      user: { select: { id: true, email: true, plan: true } },
    },
  });
  return NextResponse.json({ data: accounts });
});

const patchSchema = z.object({
  accountId: z.string().min(1),
  isActive: z.boolean(),
  // Admin IBAN/manuel ödeme aldığı müşteriye hangi paketi vereceğini seçer —
  // boş bırakılırsa (eski istemci) en üst pakete düşülür (patron yetkisi).
  plan: z.enum(PLAN_IDS).optional(),
});

/**
 * PATCH /api/admin/user-stores
 * Admin override: herhangi bir kullanıcının mağazasını ödemesiz aktif/pasif yapar
 * VE mağazanın paketini (ürün limitini) belirler — kullanıcı IBAN'dan ödeme
 * yaptıysa admin burada hangi pakete karşılık geldiğini seçer.
 * Plan limiti KONTROL EDİLMEZ — patron yetkisi.
 */
export const PATCH = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { accountId, isActive, plan } = parsed.data;
  const account = await prisma.ebayAccount.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) {
    return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
  }

  const resolvedPlan = plan ?? DEFAULT_COMP_PLAN;

  // Admin aktivasyonu = ücretsiz süresiz erişim (comp). paidUntil uzak geleceğe
  // set edilir ki freeze-stores worker'ı dondurmasın. Pasifleştirince temizlenir.
  // PAKET = MAĞAZA: seçilen paket + ona ait ürün limiti burada yazılır.
  await prisma.ebayAccount.update({
    where: { id: accountId },
    data: {
      isActive,
      activatedAt: isActive ? new Date() : null,
      paidUntil: isActive ? ADMIN_COMP_UNTIL : null,
      ...(isActive
        ? { plan: resolvedPlan, productLimit: getPlan(resolvedPlan)?.productLimit ?? 10000 }
        : {}),
    },
  });

  return NextResponse.json({ ok: true, isActive, plan: isActive ? resolvedPlan : undefined });
});
