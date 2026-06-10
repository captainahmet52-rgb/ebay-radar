import { NextRequest, NextResponse } from "next/server";
import { requireCron } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pollProductQueue } from "@/lib/queues";
import type { PollTier } from "@/types";

export const POST = requireCron(async (req) => {
  try {
    const body = await req.json() as { tier?: string };
    const { tier } = body;

    if (!tier || !["hot", "normal", "dead"].includes(tier)) {
      return NextResponse.json(
        { error: "Geçerli tier: 'hot', 'normal' veya 'dead'" },
        { status: 400 }
      );
    }

    const pollTier = tier as PollTier;

    // O tier'daki tüm aktif ürünleri al
    const products = await prisma.product.findMany({
      where: {
        pollTier,
        status: "active",
      },
      select: { id: true, asin: true },
    });

    if (products.length === 0) {
      return NextResponse.json({ queued: 0, tier });
    }

    // Her ürün için pollProductQueue'ya ayrı job ekle
    await Promise.all(
      products.map((product) =>
        pollProductQueue.add(
          "poll-product",
          { productId: product.id },
          { jobId: `poll-${product.id}-${Date.now()}`, removeOnComplete: { count: 50 } }
        )
      )
    );

    return NextResponse.json({ queued: products.length, tier });
  } catch (err) {
    console.error("[cron/poll POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
