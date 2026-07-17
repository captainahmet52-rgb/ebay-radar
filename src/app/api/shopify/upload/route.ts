import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { shopifyUpdateListingQueue } from "@/lib/queues";
import { calculateShopifyPrice } from "@/lib/shopify/pricing";
import { determineAmazonQty } from "@/lib/amazon-repricer";
import { hasStoreAccess } from "@/lib/store-access";
import { z } from "zod";

const schema = z.object({
  accountId: z.string().min(1),
  productId: z.string().min(1),
});

/**
 * POST /api/shopify/upload — depodan seçilen ürünü kullanıcının Shopify
 * mağazasına yükler. DB'ye listing yazılır, gerçek Shopify ürün oluşturma
 * worker'da (shopify-update-listing) asenkron yapılır.
 * Korumalar: hesap sahipliği + erişim (deneme/paket) + ürün limiti + tekrar yükleme.
 */
export const POST = requireAuth(async (req, { userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek" }, { status: 400 });
  }
  const { accountId, productId } = parsed.data;

  const account = await prisma.shopifyAccount.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Mağaza bulunamadı veya erişim yetkiniz yok" }, { status: 404 });
  }
  if (!account.isActive || !hasStoreAccess(account)) {
    return NextResponse.json(
      { error: "Mağaza aboneliği aktif değil — deneme bitti veya paket süresi doldu", needUpgrade: true },
      { status: 402 }
    );
  }
  if (!account.accessTokenEncrypted) {
    return NextResponse.json({ error: "Mağaza bağlantısı eksik — yeniden bağlayın" }, { status: 409 });
  }

  const product = await prisma.amazonDepotProduct.findUnique({ where: { id: productId } });
  if (!product || product.status !== "active" || !product.brandSafe) {
    return NextResponse.json({ error: "Ürün depoda bulunamadı veya şu an yüklenemez" }, { status: 404 });
  }

  // Ürün limiti (paket başına) — ended hariç mevcut listelemeler sayılır
  const count = await prisma.shopifyListing.count({
    where: { shopifyAccountId: accountId, status: { not: "ended" } },
  });
  if (count >= account.productLimit) {
    return NextResponse.json(
      { error: `Ürün limitine ulaştın (${account.productLimit}) — paketini yükselt`, needUpgrade: true },
      { status: 402 }
    );
  }

  const pricing = calculateShopifyPrice(product.aliCostUsd, product.aliShippingUsd);
  const qty = determineAmazonQty(
    product.aliStockStatus as "in_stock" | "low" | "out" | "unknown",
    product.aliStockQty
  );
  if (qty === 0) {
    return NextResponse.json({ error: "Ürünün AliExpress stoğu şu an yok — yüklenemez" }, { status: 409 });
  }

  let listing;
  try {
    listing = await prisma.shopifyListing.create({
      data: {
        userId,
        shopifyAccountId: accountId,
        productId,
        salePrice: pricing.salePrice,
        currentQty: qty,
        status: "active",
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Bu ürün bu mağazaya zaten yüklü" }, { status: 409 });
    }
    throw err;
  }

  // Gerçek Shopify ürün oluşturma asenkron (worker) — API hızlı döner
  await shopifyUpdateListingQueue.add(
    "shopify-update-listing",
    { listingId: listing.id, price: pricing.salePrice, qty },
    { jobId: `shopify-create-listing:${listing.id}` }
  );

  return NextResponse.json({
    ok: true,
    listing: { id: listing.id, salePrice: pricing.salePrice, qty },
    estimatedProfitUsd: pricing.estimatedProfitUsd,
  });
});
