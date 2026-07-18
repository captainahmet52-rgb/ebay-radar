import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { faststart } from "@/lib/ugc-video/faststart";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/shopify/ugc-video/[id]/download — videoyu indirir.
 * fal CDN'den çekilir, faststart uygulanır (açılış kasması fix'i) ve dosya
 * olarak döner — yerel depolama gerekmez.
 */
export const GET = requireAuth(async (_req, { userId, params }) => {
  const { id } = await params;
  const job = await prisma.ugcVideoJob.findFirst({
    where: { id, userId },
    select: { videoUrl: true, status: true },
  });
  if (!job?.videoUrl || job.status !== "completed") {
    return NextResponse.json({ error: "Video hazır değil" }, { status: 404 });
  }

  try {
    const res = await fetch(job.videoUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Kaynak ${res.status} döndü`);

    const raw = Buffer.from(await res.arrayBuffer());
    const optimized = faststart(raw);

    return new NextResponse(new Uint8Array(optimized), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="ugc-video-${id}.mp4"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[ugc-video/download]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Video indirilemedi — tekrar dene" }, { status: 502 });
  }
});
