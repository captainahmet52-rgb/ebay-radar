import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/** GET /api/admin/coupons — tüm kuponları listeler. */
export const GET = requireAdmin(async () => {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: coupons });
});

const createSchema = z.object({
  code: z.string().min(3).max(40),
  rewardDays: z.number().int().min(1).max(365),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

/** POST /api/admin/coupons — yeni kupon oluşturur. */
export const POST = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  try {
    const coupon = await prisma.coupon.create({
      data: {
        code,
        rewardDays: parsed.data.rewardDays,
        maxUses: parsed.data.maxUses ?? null,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });
    return NextResponse.json(coupon, { status: 201 });
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Bu kod zaten var." }, { status: 409 });
    }
    console.error("[admin/coupons POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
