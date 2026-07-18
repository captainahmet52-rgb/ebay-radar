// fal.ai entegrasyonu — sahibin Lumina AI motorundan port:
//   Nano Banana (ürünü karaktere görsel uygulama) + Kling AI Avatar v2 (konuşan video).
// Video işi KUYRUĞA gönderilir (beklenmez) — durum ayrı yoklanır (serverless-safe).

import { fal } from "@fal-ai/client";

export type AvatarQuality = "standard" | "pro";

export const AVATAR_MODELS: Record<AvatarQuality, string> = {
  standard: "fal-ai/kling-video/ai-avatar/v2/standard",
  pro: "fal-ai/kling-video/ai-avatar/v2/pro",
};

let configured = false;
function ensureConfig() {
  if (!configured) {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY eksik.");
    fal.config({ credentials: key });
    configured = true;
  }
}

/** Ses (mp3) → fal storage → public URL. */
export async function uploadAudio(audio: Buffer): Promise<string> {
  ensureConfig();
  const file = new File([new Uint8Array(audio)], "speech.mp3", { type: "audio/mpeg" });
  return fal.storage.upload(file);
}

/** Kullanıcının karakter görseli → fal storage → public URL (yerel disk gerekmez). */
export async function uploadImage(image: Buffer, mime: string): Promise<string> {
  ensureConfig();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const file = new File([new Uint8Array(image)], `character.${ext}`, { type: mime });
  return fal.storage.upload(file);
}

/** Sahne talimatı boşsa kullanılan genel amaçlı yerleştirme talimatı. */
const FALLBACK_SCENE =
  "The person from image 1 naturally wearing or holding the product from image 2, " +
  "product clearly visible, keep the person's face identity, pose and background unchanged, realistic photo";

/**
 * Nano Banana (Gemini görüntü düzenleme, fal üzerinden) — ürünü karaktere
 * GÖRSEL olarak uygular: giyilebilirse giydirir, değilse eline verir.
 * Dönen URL Kling AI Avatar'a karakter görseli olarak gider.
 */
export async function applyProductToCharacter(
  characterImageUrl: string,
  productImageUrl: string,
  sceneInstruction: string
): Promise<string> {
  ensureConfig();

  const prompt =
    (sceneInstruction.trim() || FALLBACK_SCENE) +
    ". Preserve the framing and orientation of image 1.";

  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt,
      image_urls: [characterImageUrl, productImageUrl],
      num_images: 1,
      output_format: "jpeg",
    },
  });

  const url = (result.data as { images?: { url?: string }[] })?.images?.[0]?.url;
  if (!url) throw new Error("Ürün uygulama adımı görsel döndürmedi.");
  return url;
}

/** Kling AI Avatar v2 işini kuyruğa gönderir → request_id döner. */
export async function submitAvatarJob(
  imageUrl: string,
  audioUrl: string,
  quality: AvatarQuality
): Promise<string> {
  ensureConfig();
  const { request_id } = await fal.queue.submit(AVATAR_MODELS[quality], {
    input: { image_url: imageUrl, audio_url: audioUrl },
  });
  return request_id;
}

export interface AvatarJobStatus {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "ERROR";
  videoUrl?: string;
}

/** Kuyruk işinin durumunu kontrol eder; bittiğinde video URL'sini döner. */
export async function checkAvatarJob(
  requestId: string,
  quality: AvatarQuality
): Promise<AvatarJobStatus> {
  ensureConfig();
  const model = AVATAR_MODELS[quality];

  const status = await fal.queue.status(model, { requestId });

  if (status.status === "COMPLETED") {
    const result = await fal.queue.result(model, { requestId });
    const videoUrl = (result.data as { video?: { url?: string } })?.video?.url;
    return { status: "COMPLETED", videoUrl };
  }

  if (status.status === "IN_PROGRESS") return { status: "IN_PROGRESS" };
  return { status: "IN_QUEUE" };
}
