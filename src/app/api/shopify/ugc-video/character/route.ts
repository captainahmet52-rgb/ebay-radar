import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { rateLimitAsync } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/ugc-video/fal";
import { isUgcVideoConfigured } from "@/lib/ugc-video/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * POST /api/shopify/ugc-video/character — karakter (oyuncu) fotoğrafı yükler.
 * Dosya fal storage'a gider, dönen URL video üretiminde kullanılır —
 * sunucuda yerel depolama tutulmaz.
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!isUgcVideoConfigured()) {
    return NextResponse.json(
      { error: "Video üretim motoru henüz yapılandırılmadı" },
      { status: 503 }
    );
  }

  const rl = await rateLimitAsync(`ugc-character:${userId}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla yükleme — biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Görsel dosyası gerekli (image alanı)" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Yalnız JPG/PNG/WEBP kabul edilir" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Dosya çok büyük (en fazla 8 MB)" }, { status: 400 });
  }

  try {
    const url = await uploadImage(Buffer.from(await file.arrayBuffer()), file.type);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error("[ugc-video/character]", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Yükleme başarısız — tekrar dene" }, { status: 502 });
  }
});
