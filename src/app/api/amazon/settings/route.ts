import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Pazar başına müşteri marj override — null = pazar varsayılanı (us %20, uk/ae %25, sa %30)
const marginPct = z.number().min(0).max(90).nullable();

const settingsSchema = z.object({
  amazonAutoUploadEnabled: z.boolean(),
  amazonUploadDailyLimit:  z.number().int().min(1).max(500),
  amazonUploadMinCostUsd:  z.number().min(0),
  amazonUploadMaxCostUsd:  z.number().min(0),
  amazonUploadQuantity:    z.number().int().min(1).max(10),
  amazonUploadAutoPublish: z.boolean(),
  amazonMarginUsPct:       marginPct,
  amazonMarginUkPct:       marginPct,
  amazonMarginAePct:       marginPct,
  amazonMarginSaPct:       marginPct,
});

const SELECT = {
  amazonAutoUploadEnabled: true,
  amazonUploadDailyLimit:  true,
  amazonUploadMinCostUsd:  true,
  amazonUploadMaxCostUsd:  true,
  amazonUploadQuantity:    true,
  amazonUploadAutoPublish: true,
  amazonMarginUsPct:       true,
  amazonMarginUkPct:       true,
  amazonMarginAePct:       true,
  amazonMarginSaPct:       true,
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: SELECT,
  });

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.amazonUploadMaxCostUsd < parsed.data.amazonUploadMinCostUsd) {
    return NextResponse.json({ error: "Üst maliyet alt maliyetten küçük olamaz" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: SELECT,
  });

  return NextResponse.json({ ok: true, data: updated });
}
