// Admin inceleme kuyruğu — radar'ın "orta kanıt" (status=review) olarak işaretlediği
// depo ürünleri. Otomatik dağıtılmazlar; admin onaylar (→ active) ya da reddeder
// (→ rejected; ASIN unique olduğu için bir daha radar tarafından eklenmez).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip = (page - 1) * limit;

  const where = { status: "review" as const };
  const [products, total] = await Promise.all([
    prisma.depotProduct.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { sourceStore: { select: { ebayUsername: true } } },
    }),
    prisma.depotProduct.count({ where }),
  ]);

  return NextResponse.json({
    data: products,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

const actionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export const POST = requireAdmin(async (req) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek", details: parsed.error.flatten() }, { status: 400 });
  }
  const { id, action } = parsed.data;

  // Yalnız "review" durumundaki ürün üzerinde işlem yapılır (idempotent koruma)
  const existing = await prisma.depotProduct.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ürün bulunamadı" }, { status: 404 });
  }
  if (existing.status !== "review") {
    return NextResponse.json({ error: `Ürün incelemede değil (durum: ${existing.status})` }, { status: 409 });
  }

  const newStatus = action === "approve" ? "active" : "rejected";
  await prisma.depotProduct.update({ where: { id }, data: { status: newStatus } });

  return NextResponse.json({ success: true, id, status: newStatus });
});
