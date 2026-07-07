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
import { chunk, runBatched, DB_CHUNK, DB_CONCURRENCY } from "@/lib/batch";

const IntakeProductSchema = z.object({
  asin: z.string().min(5).max(20),
  title: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  // Radar sourceMarket: AMAZON_US → US, AMAZON_UK → UK, AMAZON_DE → DE
  amazonMarket: z.enum(["US", "UK", "DE"]).default("US"),
  amazonPrice: z.number().positive().nullable().optional(),
  competitorPrice: z.number().positive().nullable().optional(), // rakibin eBay fiyatı
  soldCount: z.number().int().min(0).nullable().optional(), // talep kanıtı
  // Rakipte en son gözlenen satış anı (ISO) — "son X günde satılmış" filtresi
  lastSoldAt: z.coerce.date().nullable().optional(),
  projectedProfit: z.number().nullable().optional(),
  projectedMarginPct: z.number().nullable().optional(),
  // sourceKeyword kabul edilir ama SAKLANMAZ: DepotProduct'taki kolon
  // 20260705190000_remove_ebay_radar migration'ıyla düşürüldü.
  sourceKeyword: z.string().nullable().optional(),
});

const IntakeBodySchema = z.object({
  products: z.array(IntakeProductSchema).min(1).max(500),
});

type IntakeProduct = z.infer<typeof IntakeProductSchema>;

/** Dağıtım sırası skoru: kâr × talep (rankScore) — distribute-products job'ı en
 * yüksek skordan dağıtır. Veri eksikse 0 (sona düşer). */
function buildDepotData(p: IntakeProduct) {
  const rankScore =
    (p.projectedProfit ?? 0) > 0 && (p.soldCount ?? 0) > 0
      ? (p.projectedProfit ?? 0) * Math.log2(1 + (p.soldCount ?? 0))
      : 0;
  return {
    title: p.title ?? undefined,
    imageUrl: p.imageUrl ?? undefined,
    amazonMarket: p.amazonMarket,
    amazonPrice: p.amazonPrice ?? undefined,
    competitorPrice: p.competitorPrice ?? undefined,
    soldCount: p.soldCount ?? undefined,
    lastSoldAt: p.lastSoldAt ?? undefined,
    projectedProfit: p.projectedProfit ?? undefined,
    projectedMarginPct: p.projectedMarginPct ?? undefined,
    rankScore,
  };
}

export const POST = requireCron(async (req) => {
  const parsed = IntakeBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz gövde", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const products = parsed.data.products;

  // Hangi ASIN'ler zaten depoda — findUnique döngüsü DEĞİL. IN(...) parçalanır ki
  // parti büyüse bile Postgres parametre sınırına (~65535) takılmasın.
  const existingAsins = new Set<string>();
  for (const part of chunk(products.map((p) => p.asin), DB_CHUNK)) {
    const rows = await prisma.depotProduct.findMany({ where: { asin: { in: part } }, select: { asin: true } });
    for (const r of rows) existingAsins.add(r.asin);
  }
  const newProducts = products.filter((p) => !existingAsins.has(p.asin));
  const updateProducts = products.filter((p) => existingAsins.has(p.asin));

  // Yeni ürünler parçalı createMany (N kez create DEĞİL; tek dev insert de DEĞİL).
  for (const part of chunk(newProducts, DB_CHUNK)) {
    await prisma.depotProduct.createMany({
      data: part.map((p) => ({ asin: p.asin, ...buildDepotData(p) })),
      skipDuplicates: true, // yarış durumunda (aynı ASIN başka push'ta oluştu) sessizce atla
    });
  }

  // Güncellemeler updateMany ile YAPILAMAZ (her satıra farklı veri) — sınırsız
  // Promise.all yerine SINIRLI eş zamanlılık (bağlantı havuzunu boğmaz).
  if (updateProducts.length > 0) {
    await runBatched(updateProducts, DB_CONCURRENCY, (p) =>
      prisma.depotProduct.update({ where: { asin: p.asin }, data: buildDepotData(p) })
    );
  }

  return NextResponse.json({ ok: true, created: newProducts.length, updated: updateProducts.length });
});
