import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  amountUsd: z.number().refine((n) => n !== 0, "0 olamaz"),
  note: z.string().max(200).optional(),
});

/**
 * POST /api/admin/credit
 * Bir kullanıcının cüzdanına kredi ekler/çıkarır (manuel yükleme / düzeltme).
 * Self-servis Paddle yüklemesi ödeme entegrasyonuyla (Adım 8) gelecek.
 */
export const POST = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, amountUsd, note } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, creditBalanceUsd: true },
  });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  // Bakiye asla 0'ın altına düşemez — atomik cüzdan mantığını korur.
  // Negatif düşürme bakiyeyi aşıyorsa işlemi reddet (clamp değil, reddet).
  if (user.creditBalanceUsd + amountUsd < 0) {
    return NextResponse.json(
      {
        error: "Yetersiz bakiye: bu düşürme bakiyeyi negatife çekerdi",
        balanceUsd: user.creditBalanceUsd,
      },
      { status: 400 }
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { creditBalanceUsd: { increment: amountUsd } },
      select: { creditBalanceUsd: true },
    }),
    prisma.creditTransaction.create({
      data: { userId: user.id, amountUsd, type: "topup", note: note ?? "Admin yükleme" },
    }),
  ]);

  return NextResponse.json({ ok: true, balanceUsd: updated.creditBalanceUsd });
});
