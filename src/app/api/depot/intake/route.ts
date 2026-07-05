// POST /api/depot/intake — Radar sisteminden (urun-radari) depoya ürün kabulü.
// Radar keşif yapar (rakip eBay mağazası → Amazon ASIN eşleşmesi + satış
// kanıtı + marj hesabı) ve bulduklarını buraya gönderir; stok/fiyat takibi
// ve listeleme TAMAMEN bu projenin sorumluluğundadır (poll-product/repricer).
// Kimlik: Authorization: Bearer ${CRON_SECRET} (requireCron — Radar'ın
// .env'indeki EBAY_DEPOT_SECRET ile aynı değer olmalı).
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCron } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const IntakeProductSchema = z.object({
  asin: z.string().min(5).max(20),
  title: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  // Radar sourceMarket: AMAZON_US → US, AMAZON_UK → UK
  amazonMarket: z.enum(["US", "UK"]).default("US"),
  amazonPrice: z.number().positive().nullable().optional(),
  competitorPrice: z.number().positive().nullable().optional(), // rakibin eBay fiyatı
  soldCount: z.number().int().min(0).nullable().optional(), // talep kanıtı
  projectedProfit: z.number().nullable().optional(),
  projectedMarginPct: z.number().nullable().optional(),
  sourceKeyword: z.string().nullable().optional(), // Radar'da kaynak mağaza etiketi taşınır
});

const IntakeBodySchema = z.object({
  products: z.array(IntakeProductSchema).min(1).max(200),
});

export const POST = requireCron(async (req) => {
  const parsed = IntakeBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz gövde", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;

  for (const p of parsed.data.products) {
    // Dağıtım sırası skoru: kâr × talep (rankScore) — distribute-products
    // job'ı en yüksek skordan dağıtır. Veri eksikse 0 (sona düşer).
    const rankScore =
      (p.projectedProfit ?? 0) > 0 && (p.soldCount ?? 0) > 0
        ? (p.projectedProfit ?? 0) * Math.log2(1 + (p.soldCount ?? 0))
        : 0;

    const data = {
      title: p.title ?? undefined,
      imageUrl: p.imageUrl ?? undefined,
      amazonMarket: p.amazonMarket,
      amazonPrice: p.amazonPrice ?? undefined,
      competitorPrice: p.competitorPrice ?? undefined,
      soldCount: p.soldCount ?? undefined,
      projectedProfit: p.projectedProfit ?? undefined,
      projectedMarginPct: p.projectedMarginPct ?? undefined,
      sourceKeyword: p.sourceKeyword ?? undefined,
      rankScore,
    };

    const existing = await prisma.depotProduct.findUnique({ where: { asin: p.asin } });
    if (existing) {
      await prisma.depotProduct.update({ where: { asin: p.asin }, data });
      updated++;
    } else {
      await prisma.depotProduct.create({ data: { asin: p.asin, ...data } });
      created++;
    }
  }

  return NextResponse.json({ ok: true, created, updated });
});
