import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { radarScanQueue } from "@/lib/queues";

export const DELETE = requireAdmin(async (req, { params }) => {
  const { id } = await params;
  await prisma.trackedStore.delete({ where: { id } });
  return NextResponse.json({ success: true });
});

// POST /api/admin/stores/[id] — manuel radar tetikle
export const POST = requireAdmin(async (req, { params }) => {
  const { id } = await params;
  const store = await prisma.trackedStore.findUnique({ where: { id } });
  if (!store) {
    return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
  }

  await radarScanQueue.add(
    "radar-scan",
    { trackedStoreId: id },
    { jobId: `radar-scan:${id}:${Date.now()}` }
  );
  return NextResponse.json({ success: true, message: "Radar tarama başlatıldı" });
});
