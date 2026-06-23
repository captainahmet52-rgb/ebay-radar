import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { ADMIN_COMP_UNTIL } from "@/lib/store-access";
import { z } from "zod";

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
      user: { select: { id: true, email: true, plan: true } },
    },
  });
  return NextResponse.json({ data: accounts });
});

const patchSchema = z.object({
  accountId: z.string().min(1),
  isActive: z.boolean(),
});

/**
 * PATCH /api/admin/user-stores
 * Admin override: herhangi bir kullanıcının mağazasını ödemesiz aktif/pasif yapar.
 * Plan limiti KONTROL EDİLMEZ — patron yetkisi.
 */
export const PATCH = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { accountId, isActive } = parsed.data;
  const account = await prisma.ebayAccount.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) {
    return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
  }

  // Admin aktivasyonu = ücretsiz süresiz erişim (comp). paidUntil uzak geleceğe
  // set edilir ki freeze-stores worker'ı dondurmasın. Pasifleştirince temizlenir.
  await prisma.ebayAccount.update({
    where: { id: accountId },
    data: {
      isActive,
      activatedAt: isActive ? new Date() : null,
      paidUntil: isActive ? ADMIN_COMP_UNTIL : null,
    },
  });

  return NextResponse.json({ ok: true, isActive });
});
