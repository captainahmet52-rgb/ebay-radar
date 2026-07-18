import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { finalizeUgcVideo } from "@/lib/ugc-video/pipeline";

/**
 * GET /api/shopify/ugc-video/[id] — iş durumu. UI 5 sn'de bir yoklar;
 * her yoklamada fal kuyruğu kontrol edilir (FAZ 2), bittiyse sonuç yazılır.
 */
export const GET = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;
  const job = await prisma.ugcVideoJob.findFirst({
    where: { id, userId },
    select: {
      id: true,
      status: true,
      step: true,
      quality: true,
      seconds: true,
      spokenText: true,
      videoUrl: true,
      error: true,
      falRequestId: true,
      createdAt: true,
    },
  });
  if (!job) {
    return NextResponse.json({ error: "İş bulunamadı" }, { status: 404 });
  }

  const fresh = await finalizeUgcVideo(job);
  return NextResponse.json({
    job: {
      id: fresh.id,
      status: fresh.status,
      step: fresh.step,
      quality: fresh.quality,
      seconds: fresh.seconds,
      spokenText: fresh.spokenText,
      videoUrl: fresh.videoUrl,
      error: fresh.error,
      createdAt: fresh.createdAt,
    },
  });
});
