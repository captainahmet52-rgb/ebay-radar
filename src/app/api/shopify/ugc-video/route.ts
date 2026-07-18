import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { rateLimitAsync } from "@/lib/rate-limit";
import {
  isUgcVideoConfigured,
  ugcVideoPriceUsd,
  UGC_VIDEO_PRICES,
  chargeAndCreateJob,
  startUgcVideo,
} from "@/lib/ugc-video/pipeline";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60; // FAZ 1: metin + ses + kuyruğa gönderim (~15-30sn)

const schema = z.object({
  listingId: z.string().min(1),
  characterImageUrl: z.string().url().max(2000),
  quality: z.enum(["standard", "pro"]).default("standard"),
  seconds: z.union([z.literal(15), z.literal(30), z.literal(45)]).default(15),
});

/**
 * POST /api/shopify/ugc-video — otomatik UGC video üretimi başlatır.
 * Ücret kredi cüzdanından ATOMİK düşer (yetmezse 402); üretim patlarsa iade.
 * GET /api/shopify/ugc-video — kullanıcının video işleri (en yeni önce).
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!isUgcVideoConfigured()) {
    return NextResponse.json(
      { error: "Video üretim motoru henüz yapılandırılmadı (FAL/ElevenLabs anahtarları)" },
      { status: 503 }
    );
  }

  // Maliyet freni: saatte 10 video üretimi fazlasıyla yeter
  const rl = await rateLimitAsync(`ugc-video:${userId}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla video istedin — biraz sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }

  const listing = await prisma.shopifyListing.findFirst({
    where: { id: parsed.data.listingId, userId },
    include: { product: { select: { title: true, imageUrl: true, aliId: true } } },
  });
  if (!listing) {
    return NextResponse.json({ error: "Ürün bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }
  if (!listing.product.imageUrl) {
    return NextResponse.json({ error: "Bu ürünün görseli yok — video üretilemez" }, { status: 400 });
  }

  const charged = await chargeAndCreateJob({
    userId,
    listingId: listing.id,
    quality: parsed.data.quality,
    seconds: parsed.data.seconds,
    characterImageUrl: parsed.data.characterImageUrl,
  });
  if (!charged) {
    return NextResponse.json(
      {
        error: `Kredi bakiyen yetersiz (video ücreti $${ugcVideoPriceUsd(parsed.data.quality, parsed.data.seconds).toFixed(2)}) — canlı destekten kredi yükleyebilirsin.`,
      },
      { status: 402 }
    );
  }

  // FAZ 1 await edilir (~15-30 sn) — hata pipeline içinde yakalanır ve iade edilir
  await startUgcVideo({
    jobId: charged.jobId,
    characterImageUrl: parsed.data.characterImageUrl,
    productImageUrl: listing.product.imageUrl,
    productName: listing.product.title ?? `Ürün ${listing.product.aliId}`,
    seconds: parsed.data.seconds,
    quality: parsed.data.quality,
  });

  return NextResponse.json({ ok: true, jobId: charged.jobId }, { status: 201 });
});

export const GET = requireAuth(async (_req, { userId }) => {
  const jobs = await prisma.ugcVideoJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      step: true,
      quality: true,
      seconds: true,
      spokenText: true,
      videoUrl: true,
      error: true,
      priceUsd: true,
      createdAt: true,
      listing: {
        select: { id: true, product: { select: { title: true, imageUrl: true } } },
      },
    },
  });

  return NextResponse.json({ jobs, priceTable: UGC_VIDEO_PRICES });
});
