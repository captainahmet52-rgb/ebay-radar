// POST /api/amazon-depot/intake — Radar (urun-radari) AmazonBot radarının bulduğu
// KAZANAN ürünleri Amazon deposuna alır. Keşif/skorlama Radar'da; stok/fiyat takibi,
// listeleme ve sipariş bu projenin sorumluluğundadır.
// Kimlik: Authorization: Bearer ${CRON_SECRET} (requireCron — Radar'ın .env'indeki
// EBAY_AMAZON_DEPOT_SECRET / EBAY_DEPOT_SECRET ile aynı değer olmalı).
// eBay tarafındaki /api/depot/intake'in Amazon ikizi.
//
// Ürün başına doğrulama: tek bozuk ürün partiyi reddettirmez. Yanıttaki savedIds
// Radar'a hangi ürünlerin GERÇEKTEN depoya girdiğini söyler — Radar yalnız bunları
// "görüldü" sayar, gerisini sonraki turda tekrar dener.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCron } from "@/lib/api-helpers";
import { upsertAmazonDepotProducts } from "@/lib/amazon-depot";
import { partitionIntakeItems, MAX_INTAKE_BATCH } from "@/lib/amazon-depot-intake";

const BodySchema = z.object({
  products: z.array(z.unknown()).min(1).max(MAX_INTAKE_BATCH),
});

export const POST = requireCron(async (req) => {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz gövde", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { valid, rejected } = partitionIntakeItems(parsed.data.products);
  if (rejected.length > 0) {
    console.warn(
      `[amazon-depot/intake] ${rejected.length} ürün reddedildi, ilk: ${rejected[0].aliId ?? "?"} — ${rejected[0].reason}`
    );
  }
  if (valid.length === 0) {
    return NextResponse.json(
      { error: "Geçerli ürün yok", saved: 0, savedIds: [], rejected },
      { status: 400 }
    );
  }

  const { saved, savedIds, failedIds } = await upsertAmazonDepotProducts(valid);
  return NextResponse.json({
    ok: true,
    saved,
    savedIds,
    rejected: [...rejected, ...failedIds.map((aliId) => ({ aliId, reason: "kayıt hatası" }))],
  });
});
