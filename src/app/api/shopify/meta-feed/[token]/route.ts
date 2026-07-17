import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shopify/meta-feed/[token] — Meta (Facebook/Instagram) katalog beslemesi.
 *
 * Meta Commerce Manager "scheduled feed" olarak bu URL'i verir; Meta düzenli
 * aralıklarla çeker. CSV formatı Meta'nın ürün katalog şemasına uygundur:
 * https://www.facebook.com/business/help/120325381656392
 *
 * Kimlik: URL'deki token = ShopifyAccount.feedToken (tahmin edilemez, hesaba özel).
 * Oturum YOK (Meta sunucusu çeker) — token tek yetkilendirme kapısıdır.
 * Yalnız AKTİF listelemeler beslemeye girer (duraklatılan ürün reklamdan düşer).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Geçersiz feed adresi" }, { status: 404 });
  }

  const account = await prisma.shopifyAccount.findUnique({
    where: { feedToken: token },
    select: { id: true, shopDomain: true, isActive: true },
  });
  if (!account || !account.isActive) {
    return NextResponse.json({ error: "Feed bulunamadı" }, { status: 404 });
  }

  const listings = await prisma.shopifyListing.findMany({
    where: { shopifyAccountId: account.id, status: "active", shopifyProductId: { not: null } },
    include: {
      product: { select: { title: true, imageUrl: true, category: true } },
    },
    take: 5000,
  });

  // CSV alanları: Meta katalog zorunlu kolonları
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = "id,title,description,availability,condition,price,link,image_link,brand";
  const rows = listings.map((l) => {
    const title = l.product.title ?? "Ürün";
    // Shopify GID → sayısal ürün ID (mağaza linki için)
    const numericId = (l.shopifyProductId ?? "").split("/").pop() ?? l.id;
    const link = `https://${account.shopDomain}/products/${numericId}`;
    return [
      esc(l.id),
      esc(title.slice(0, 150)),
      esc(title.slice(0, 4900)),
      "in stock",
      "new",
      `${(l.salePrice ?? 0).toFixed(2)} USD`,
      esc(link),
      esc(l.product.imageUrl ?? ""),
      esc("Lean Store"),
    ].join(",");
  });

  return new NextResponse([header, ...rows].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      // Meta düzenli çeker — kısa cache yeterli
      "Cache-Control": "public, max-age=900",
    },
  });
}
