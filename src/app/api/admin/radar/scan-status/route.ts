// Radar tarama ilerlemesi — UI bunu jobId ile yoklar (2 sn'de bir) ve bar gösterir.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { radarScanQueue } from "@/lib/queues";

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId gerekli" }, { status: 400 });

  const job = await radarScanQueue.getJob(jobId);
  if (!job) {
    // İş kuyruktan silinmiş (tamamlanıp temizlenmiş) → bitmiş say
    return NextResponse.json({ state: "unknown", progress: null });
  }

  const state = await job.getState(); // waiting | active | completed | failed | delayed
  return NextResponse.json({ state, progress: job.progress ?? null });
});
