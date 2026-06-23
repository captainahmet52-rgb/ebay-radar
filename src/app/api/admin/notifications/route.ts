import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/** GET /api/admin/notifications — bildirimleri + okunmamış sayısını döndürür. */
export const GET = requireAdmin(async () => {
  const [data, unread] = await Promise.all([
    prisma.adminNotification.findMany({
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.adminNotification.count({ where: { isRead: false } }),
  ]);
  return NextResponse.json({ data, unread });
});

const patchSchema = z.object({
  id: z.string().optional(),
  markAllRead: z.boolean().optional(),
});

/** PATCH /api/admin/notifications — tek bildirimi veya tümünü okundu işaretle. */
export const PATCH = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  if (parsed.data.markAllRead) {
    await prisma.adminNotification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  } else if (parsed.data.id) {
    await prisma.adminNotification.update({ where: { id: parsed.data.id }, data: { isRead: true } });
  } else {
    return NextResponse.json({ error: "id veya markAllRead gerekli" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
});
