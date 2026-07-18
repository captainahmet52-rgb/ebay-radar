// UGC video üretim hattı — Lumina AI pipeline'ının Lean Automation portu.
// Fark: kredi Lean Automation'ın kredi cüzdanından (creditBalanceUsd) düşer;
// düşme ATOMİK koşullu güncelleme (convert-tracking'teki desen), patlarsa İADE.
//
// FAZ 1 (üretim isteğinde await, ~15-30 sn): Haiku konuşma metni (EN, vision)
//   → paralel: Nano Banana ürün-karaktere uygulama + ElevenLabs ses →
//   Kling Avatar v2 fal KUYRUĞUNA gönderilir (beklenmez).
// FAZ 2 (UI durum yokladıkça): fal kuyruğu kontrol; bitti → videoUrl kaydet;
//   hata → kredi iade (bir kez).

import { prisma } from "@/lib/prisma";
import { generateUgcSpeech } from "./speech";
import { textToSpeech } from "./elevenlabs";
import {
  applyProductToCharacter,
  uploadAudio,
  submitAvatarJob,
  checkAvatarJob,
  type AvatarQuality,
} from "./fal";

export function isUgcVideoConfigured(): boolean {
  return Boolean(
    process.env.FAL_KEY && process.env.ELEVENLABS_API_KEY && process.env.ANTHROPIC_API_KEY
  );
}

// ⚠️ TASLAK fiyatlar (kredi cüzdanından düşen USD) — env ile ezilebilir.
// Kaynak maliyet: Kling Avatar v2 + ElevenLabs + Nano Banana + Haiku.
export function ugcVideoPriceUsd(quality: AvatarQuality): number {
  const std = parseFloat(process.env.UGC_VIDEO_PRICE_USD ?? "3");
  const pro = parseFloat(process.env.UGC_VIDEO_PRICE_PRO_USD ?? "6");
  return quality === "pro" ? pro : std;
}

/**
 * Krediyi ATOMİK düşer + iş kaydını oluşturur (tek transaction).
 * Bakiye yetmezse null döner (hiçbir şey yazılmaz).
 */
export async function chargeAndCreateJob(params: {
  userId: string;
  listingId: string;
  quality: AvatarQuality;
  seconds: number;
  characterImageUrl: string;
}): Promise<{ jobId: string } | null> {
  const price = ugcVideoPriceUsd(params.quality);

  return prisma.$transaction(async (tx) => {
    const charged = await tx.user.updateMany({
      where: { id: params.userId, creditBalanceUsd: { gte: price } },
      data: { creditBalanceUsd: { decrement: price } },
    });
    if (charged.count === 0) return null; // bakiye yetersiz

    const job = await tx.ugcVideoJob.create({
      data: {
        userId: params.userId,
        listingId: params.listingId,
        quality: params.quality,
        seconds: params.seconds,
        characterImageUrl: params.characterImageUrl,
        priceUsd: price,
        step: "Başlatılıyor…",
      },
      select: { id: true },
    });

    await tx.creditTransaction.create({
      data: {
        userId: params.userId,
        amountUsd: -price,
        type: "ugc_video",
        refId: job.id,
        note: `UGC video üretimi (${params.quality}, ${params.seconds}sn)`,
      },
    });

    return { jobId: job.id };
  });
}

/** Başarısız üretimde krediyi bir kez iade eder (refunded bayrağı yarışa karşı gate). */
async function refundOnce(jobId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const gate = await tx.ugcVideoJob.updateMany({
      where: { id: jobId, refunded: false },
      data: { refunded: true },
    });
    if (gate.count === 0) return; // zaten iade edilmiş

    const job = await tx.ugcVideoJob.findUnique({
      where: { id: jobId },
      select: { userId: true, priceUsd: true },
    });
    if (!job) return;

    await tx.user.update({
      where: { id: job.userId },
      data: { creditBalanceUsd: { increment: job.priceUsd } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: job.userId,
        amountUsd: job.priceUsd,
        type: "refund",
        refId: jobId,
        note: "UGC video üretimi başarısız — iade",
      },
    });
  });
}

async function patchJob(
  jobId: string,
  data: Parameters<typeof prisma.ugcVideoJob.update>[0]["data"]
): Promise<void> {
  await prisma.ugcVideoJob.update({ where: { id: jobId }, data }).catch(() => {});
}

/** FAZ 1 — metin + ses + görsel hazırlığı, fal kuyruğuna gönderim. */
export async function startUgcVideo(params: {
  jobId: string;
  characterImageUrl: string;
  productImageUrl: string;
  productName: string;
  seconds: number;
  quality: AvatarQuality;
}): Promise<void> {
  const { jobId } = params;

  try {
    await patchJob(jobId, { step: "Konuşma metni yazılıyor…" });
    const speech = await generateUgcSpeech({
      characterImageUrl: params.characterImageUrl,
      productImageUrl: params.productImageUrl,
      productName: params.productName,
      seconds: params.seconds,
    });

    await patchJob(jobId, {
      step: "Ürün karaktere uygulanıyor + ses üretiliyor…",
      spokenText: speech.text,
    });

    // Ürünü karaktere uygula (Nano Banana) — TTS ile PARALEL.
    // Uygulama patlarsa orijinal karakter görseliyle devam (video yine çıkar).
    const [editedImageUrl, audioUrl] = await Promise.all([
      applyProductToCharacter(
        params.characterImageUrl,
        params.productImageUrl,
        speech.scene
      ).catch(() => params.characterImageUrl),
      textToSpeech(speech.text, speech.gender).then(uploadAudio),
    ]);

    const requestId = await submitAvatarJob(editedImageUrl, audioUrl, params.quality);

    await patchJob(jobId, {
      step: "Video üretiliyor… (2-4 dk sürebilir)",
      editedImageUrl,
      falRequestId: requestId,
    });
  } catch (err) {
    await refundOnce(jobId);
    await patchJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Üretim hatası",
      completedAt: new Date(),
      step: null,
    });
  }
}

export interface UgcJobRow {
  id: string;
  status: string;
  step: string | null;
  quality: string;
  seconds: number;
  spokenText: string | null;
  videoUrl: string | null;
  error: string | null;
  falRequestId: string | null;
  createdAt: Date;
}

/** FAZ 2 — UI durum yokladıkça çağrılır; fal kuyruğunu kontrol edip sonucu yazar. */
export async function finalizeUgcVideo(job: UgcJobRow): Promise<UgcJobRow> {
  if (job.status !== "processing" || !job.falRequestId) return job;

  try {
    const result = await checkAvatarJob(job.falRequestId, job.quality as AvatarQuality);

    if (result.status === "COMPLETED" && result.videoUrl) {
      const patch = {
        status: "completed",
        videoUrl: result.videoUrl,
        completedAt: new Date(),
        step: "Tamamlandı",
      };
      await patchJob(job.id, patch);
      return { ...job, status: "completed", videoUrl: result.videoUrl, step: "Tamamlandı" };
    }

    if (result.status === "ERROR") {
      await refundOnce(job.id);
      const errText = "Video üretimi başarısız oldu — kredin iade edildi.";
      await patchJob(job.id, {
        status: "failed",
        error: errText,
        completedAt: new Date(),
        step: null,
      });
      return { ...job, status: "failed", error: errText, step: null };
    }
  } catch {
    // Geçici hata — bir sonraki yoklamada tekrar denenir.
  }

  return job;
}
