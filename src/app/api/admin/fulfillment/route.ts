import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/** Varsayılan markup (USD) — admin sipariş başına değiştirebilir. */
const DEFAULT_MARKUP_USD = 5;

// Ürünün kaynak pazarına göre doğru Amazon sitesi — scraper.ts AMAZON_DOMAINS ile uyumlu.
const AMAZON_DOMAIN: Record<string, string> = {
  US: "https://www.amazon.com",
  UK: "https://www.amazon.co.uk",
  DE: "https://www.amazon.de",
  FR: "https://www.amazon.fr",
  IT: "https://www.amazon.it",
  ES: "https://www.amazon.es",
  CA: "https://www.amazon.ca",
  TR: "https://www.amazon.com.tr",
};

function amazonProductUrl(asin: string | null | undefined, market: string | null | undefined): string | null {
  if (!asin) return null;
  const domain = AMAZON_DOMAIN[market ?? "US"] ?? AMAZON_DOMAIN.US;
  return `${domain}/dp/${asin}`;
}

/**
 * GET /api/admin/fulfillment
 * Managed fulfillment akışındaki siparişleri listeler (admin sipariş havuzu).
 * Alıcı adresi (PII) + Amazon ürün linki + maliyet/takip alanları döner.
 */
export const GET = requireAdmin(async () => {
  const orders = await prisma.order.findMany({
    where: { managedStatus: { in: ["awaiting_admin", "awaiting_order_payment", "awaiting_tracking_payment"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { email: true, creditBalanceUsd: true } },
      listing: {
        select: {
          ebaySite: true,
          product: { select: { asin: true, title: true, amazonMarket: true } },
          ebayAccount: { select: { ebayUserId: true } },
        },
      },
    },
  });

  const data = orders.map((o) => ({
    id: o.id,
    ebayOrderId: o.ebayOrderId,
    managedStatus: o.managedStatus,
    soldPrice: o.soldPrice,
    sourceCostUsd: o.sourceCostUsd,
    markupUsd: o.markupUsd ?? DEFAULT_MARKUP_USD,
    amazonTrackingNo: o.amazonTrackingNo,
    trackingNumber: o.trackingNumber,
    asin: o.listing?.product?.asin ?? null,
    title: o.listing?.product?.title ?? null,
    amazonUrl: amazonProductUrl(o.listing?.product?.asin, o.listing?.product?.amazonMarket),
    store: o.listing?.ebayAccount?.ebayUserId ?? null,
    userEmail: o.user?.email ?? null,
    userBalance: o.user?.creditBalanceUsd ?? 0,
    shipTo: {
      name: o.shipToName, line1: o.shipToLine1, line2: o.shipToLine2,
      city: o.shipToCity, state: o.shipToState, zip: o.shipToZip,
      country: o.shipToCountry, phone: o.shipToPhone,
    },
    createdAt: o.createdAt,
  }));

  return NextResponse.json({ data, defaultMarkup: DEFAULT_MARKUP_USD });
});

const patchSchema = z.object({
  orderId: z.string().min(1),
  sourceCostUsd: z.number().min(0).max(100000),
  markupUsd: z.number().min(0).max(100000).optional(),
  amazonTrackingNo: z.string().max(100).optional(),
});

/**
 * PATCH /api/admin/fulfillment
 * Admin: Amazon maliyeti + markup + Amazon takip no girer.
 * → managedStatus = awaiting_order_payment (kullanıcının önüne sipariş ödemesi düşer).
 */
export const PATCH = requireAdmin(async (req) => {
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const { orderId, sourceCostUsd, markupUsd, amazonTrackingNo } = parsed.data;
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "Sipariş bulunamadı" }, { status: 404 });

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      sourceCostUsd,
      markupUsd: markupUsd ?? DEFAULT_MARKUP_USD,
      amazonTrackingNo: amazonTrackingNo ?? null,
      managedStatus: "awaiting_order_payment",
    },
    select: { id: true, managedStatus: true },
  });

  return NextResponse.json({ ok: true, ...updated });
});
