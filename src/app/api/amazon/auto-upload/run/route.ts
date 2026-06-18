import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { amazonAutoUploadQueue } from "@/lib/queues";

/**
 * POST /api/amazon/auto-upload/run
 * Mevcut kullanıcı için Amazon oto-yüklemeyi hemen kuyruğa ekler.
 */
export const POST = requireAuth(async (_req, { userId }) => {
  await amazonAutoUploadQueue.add(
    "amazon-auto-upload",
    { userId },
    { jobId: `amazon-auto-upload:${userId}:${Date.now()}` }
  );
  return NextResponse.json({ ok: true, message: "Oto-yükleme kuyruğa eklendi" });
});
