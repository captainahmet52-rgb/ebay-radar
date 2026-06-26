import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pollProductQueue } from "@/lib/queues";

const bodySchema = z.object({ enabled: z.boolean() });

// POST /api/ebay/imported-listings/[id]/tracking — bir onaylı ilanın takibini aç/kapat.
// AÇ: SADECE matchStatus="confirmed" + ASIN'li ilanlar. Product + legacy Listing oluşturur,
//     poll tetikler → sistem artık o ilanın fiyat/stoğunu Amazon'a göre yönetir.
// KAPAT: takibi durdurur, bağlı listing'i duraklatır (silmez).
export const POST = requireAuth(async (req, { userId, params }) => {
  try {
    const { id } = await params;
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "enabled (boolean) gerekli" }, { status: 400 });
    }
    const { enabled } = parsed.data;

    const il = await prisma.importedListing.findFirst({
      where: { id, userId }, // tenant izolasyonu
    });
    if (!il) {
      return NextResponse.json({ error: "İlan bulunamadı" }, { status: 404 });
    }

    // ── KAPAT ──
    if (!enabled) {
      await prisma.$transaction(async (tx) => {
        await tx.importedListing.update({
          where: { id: il.id },
          data: { trackingEnabled: false },
        });
        if (il.linkedListingId) {
          await tx.listing.updateMany({
            where: { id: il.linkedListingId },
            data: { status: "paused" },
          });
        }
      });
      return NextResponse.json({ data: { trackingEnabled: false } });
    }

    // ── AÇ ── (SIFIR HATA: sadece confirmed + ASIN'li otomatik takibe alınır)
    if (il.matchStatus !== "confirmed" || !il.detectedAsin) {
      return NextResponse.json(
        { error: "Sadece ONAYLANMIŞ (confirmed) ve ASIN'li ilanlar takibe alınabilir" },
        { status: 409 }
      );
    }

    const productId = await prisma.$transaction(async (tx) => {
      // 1. ASIN deposunda ürünü bul/oluştur (izleme bu Product üzerinden döner)
      const product = await tx.product.upsert({
        where: { asin: il.detectedAsin! },
        create: {
          asin: il.detectedAsin!,
          title: il.title,
          imageUrl: il.imageUrl,
          amazonMarket: il.amazonMarket,
          status: "active",
        },
        update: { status: "active" },
      });

      // 2. Bu eBay ItemID için legacy Listing oluştur/yeniden aktif et (idempotent)
      const existing = await tx.listing.findFirst({
        where: { ebayAccountId: il.ebayAccountId, ebayListingId: il.ebayItemId },
        select: { id: true },
      });

      let listingId: string;
      if (existing) {
        await tx.listing.update({
          where: { id: existing.id },
          data: {
            status: "active",
            isLegacy: true,
            ebaySku: il.ebaySku,
            currentPrice: il.price,
            currentQty: il.quantity ?? 1,
          },
        });
        listingId = existing.id;
      } else {
        const created = await tx.listing.create({
          data: {
            userId,
            productId: product.id,
            ebayAccountId: il.ebayAccountId,
            ebayListingId: il.ebayItemId, // legacy ItemID
            ebaySku: il.ebaySku,
            isLegacy: true,
            ebaySite: il.ebaySite,
            currentPrice: il.price,
            currentQty: il.quantity ?? 1,
            publishStage: "published",
            status: "active",
          },
          select: { id: true },
        });
        listingId = created.id;
      }

      // 3. ImportedListing'i takibe bağla
      await tx.importedListing.update({
        where: { id: il.id },
        data: {
          trackingEnabled: true,
          linkedProductId: product.id,
          linkedListingId: listingId,
        },
      });

      return product.id;
    });

    // 4. İlk taramayı hemen tetikle (Amazon'dan taze fiyat/stok → eBay'e yansıt)
    await pollProductQueue.add(
      "poll-product",
      { productId },
      { jobId: `poll-product:${productId}` }
    );

    return NextResponse.json({ data: { trackingEnabled: true, productId } });
  } catch (err) {
    console.error("[ebay/imported-listings/[id]/tracking POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
