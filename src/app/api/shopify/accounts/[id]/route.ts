import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  // Meta Pixel ID — yalnız rakam (Meta formatı), boş string = kaldır
  metaPixelId: z.string().regex(/^\d{5,20}$/).nullable().optional(),
});

/** PATCH /api/shopify/accounts/[id] — hesap ayarları (şimdilik: Meta Pixel ID). */
export const PATCH = requireAuth(async (req, { userId, params }) => {
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz Pixel ID (yalnız rakam olmalı)" }, { status: 400 });
  }

  const account = await prisma.shopifyAccount.findFirst({ where: { id, userId } });
  if (!account) {
    return NextResponse.json({ error: "Mağaza bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }

  const updated = await prisma.shopifyAccount.update({
    where: { id },
    data: { metaPixelId: parsed.data.metaPixelId ?? null },
    select: { id: true, metaPixelId: true },
  });

  return NextResponse.json({ ok: true, account: updated });
});

/** DELETE /api/shopify/accounts/[id] — mağaza bağlantısını kaldırır. */
export const DELETE = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;

  const account = await prisma.shopifyAccount.findFirst({ where: { id, userId } });
  if (!account) {
    return NextResponse.json({ error: "Mağaza bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }

  await prisma.shopifyAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
