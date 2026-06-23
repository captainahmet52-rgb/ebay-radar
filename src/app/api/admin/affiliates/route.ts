import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * GET /api/admin/affiliates
 * Tüm affiliate'leri + arama için kullanıcıları döndürür.
 * ?q= ile e-postaya göre filtre. Varsayılan: sadece affiliate olanlar.
 */
export const GET = requireAdmin(async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const users = await prisma.user.findMany({
    where: q
      ? { email: { contains: q, mode: "insensitive" } }
      : { isAffiliate: true },
    select: {
      id: true,
      email: true,
      isAffiliate: true,
      commissionRatePct: true,
      commissionBalanceUsd: true,
      _count: { select: { referrals: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ data: users });
});

const patchSchema = z.object({
  userId: z.string().min(1),
  isAffiliate: z.boolean().optional(),
  commissionRatePct: z.number().min(0).max(90).optional(),
  addBalanceUsd: z.number().optional(),
});

/**
 * PATCH /api/admin/affiliates
 * Bir kullanıcıyı affiliate yap/çıkar, komisyon oranını ayarla veya bakiye ekle.
 */
export const PATCH = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { userId, isAffiliate, commissionRatePct, addBalanceUsd } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(isAffiliate !== undefined ? { isAffiliate } : {}),
      ...(commissionRatePct !== undefined ? { commissionRatePct } : {}),
      ...(addBalanceUsd ? { commissionBalanceUsd: { increment: addBalanceUsd } } : {}),
    },
    select: { isAffiliate: true, commissionRatePct: true, commissionBalanceUsd: true },
  });

  return NextResponse.json({ ok: true, ...updated });
});
