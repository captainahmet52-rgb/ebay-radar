// POST /api/amazon-depot/intake — Radar (urun-radari) AmazonBot radarının bulduğu
// KAZANAN ürünleri Amazon deposuna alır. Keşif/skorlama Radar'da; stok/fiyat takibi,
// listeleme ve sipariş bu projenin sorumluluğundadır.
// Kimlik: Authorization: Bearer ${CRON_SECRET} (requireCron — Radar'ın .env'indeki
// EBAY_AMAZON_DEPOT_SECRET / EBAY_DEPOT_SECRET ile aynı değer olmalı).
// eBay tarafındaki /api/depot/intake'in Amazon ikizi.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCron } from "@/lib/api-helpers";
import { upsertAmazonDepotProducts } from "@/lib/amazon-depot";

const ItemSchema = z.object({
  aliId: z.string().min(1).max(64),
  title: z.string().min(1),
  category: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  aliCostUsd: z.number().positive(),
  aliShippingUsd: z.number().min(0),
  aliOrders: z.number().int().min(0),
  aliRating: z.number().min(0).max(5),
  amazonBsr: z.number().int().min(0).nullable().optional(),
  amazonSalesEst: z.number().int().min(0).nullable().optional(),
  amazonSellerCount: z.number().int().min(0).nullable().optional(),
  amazonSoldByAmazon: z.boolean().optional(),
  radarScore: z.number().min(0).max(100),
  sourceChannel: z.enum(["amazon", "shopify"]).optional(),
});

const BodySchema = z.object({
  products: z.array(ItemSchema).min(1).max(500),
});

export const POST = requireCron(async (req) => {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz gövde", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { saved } = await upsertAmazonDepotProducts(parsed.data.products);
  return NextResponse.json({ ok: true, saved });
});
