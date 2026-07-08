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
 * Self-servis yükleme zaten var: /api/amazon/wallet/topup (Stripe, tek seferlik ödeme).
 */
export const POST = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, amountUsd, note } = parsed.data;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, creditBalanceUsd: true },
    });
    if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

    // ATOMİK: oku-sonra-yaz yarışını (TOCTOU) önle. Negatif düşürmede WHERE koşulu
    // (yeterli bakiye) ile atomik updateMany; iki eşzamanlı düşürme ikisi de geçemez.
    const result = await prisma.$transaction(async (tx) => {
      if (amountUsd < 0) {
        const upd = await tx.user.updateMany({
          where: { id: user.id, creditBalanceUsd: { gte: -amountUsd } },
          data: { creditBalanceUsd: { increment: amountUsd } },
        });
        if (upd.count === 0) return null; // yetersiz bakiye — işlem yapılmadı
      } else {
        await tx.user.update({
          where: { id: user.id },
          data: { creditBalanceUsd: { increment: amountUsd } },
        });
      }
      await tx.creditTransaction.create({
        data: { userId: user.id, amountUsd, type: "topup", note: note ?? "Admin yükleme" },
      });
      return tx.user.findUnique({ where: { id: user.id }, select: { creditBalanceUsd: true } });
    });

    if (!result) {
      return NextResponse.json(
        { error: "Yetersiz bakiye: bu düşürme bakiyeyi negatife çekerdi" },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, balanceUsd: result.creditBalanceUsd });
  } catch (err) {
    console.error("[admin/credit POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
