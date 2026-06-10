import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { radarScanQueue } from "@/lib/queues";

export const POST = requireAdmin(async () => {
  const stores = await prisma.trackedStore.findMany({ where: { isActive: true } });

  await Promise.all(
    stores.map(store =>
      radarScanQueue.add(
        "radar-scan",
        { trackedStoreId: store.id },
        { jobId: `radar-scan:${store.id}:${Date.now()}` }
      )
    )
  );

  return NextResponse.json({
    success: true,
    message: `${stores.length} mağaza için radar tarama kuyruğa eklendi`,
  });
});
