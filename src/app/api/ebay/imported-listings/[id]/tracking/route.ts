import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { enableTracking } from "@/lib/ebay/listing-import";

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

    // ── AÇ ── (SIFIR HATA: sadece confirmed + ASIN'li. enableTracking aynı koşulu
    // garanti eder + Product/legacy Listing oluşturur + ilk poll'u tetikler.)
    if (il.matchStatus !== "confirmed" || !il.detectedAsin) {
      return NextResponse.json(
        { error: "Sadece ONAYLANMIŞ (confirmed) ve ASIN'li ilanlar takibe alınabilir" },
        { status: 409 }
      );
    }

    const productId = await enableTracking(il.id);
    if (!productId) {
      return NextResponse.json({ error: "Takip açılamadı" }, { status: 409 });
    }

    return NextResponse.json({ data: { trackingEnabled: true, productId } });
  } catch (err) {
    console.error("[ebay/imported-listings/[id]/tracking POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
