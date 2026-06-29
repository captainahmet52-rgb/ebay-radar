import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { verifyImportMatchQueue } from "@/lib/queues";

const verifySchema = z.object({
  ebayAccountId: z.string().min(1),
  // İsteğe bağlı: bu çağrıda en fazla kaç ilan doğrulansın (plan kotasına kırpılır)
  limit: z.number().int().positive().optional(),
});

// POST /api/ebay/import/verify — "pending" (ASIN'li) ilanları Amazon'da doğrulamak için
// kuyruğa al. SCRAPER MALİYETİ burada → plan productLimit ile SINIRLI.
export const POST = requireAuth(async (req, { userId }) => {
  try {
    const body = await req.json().catch(() => null);
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "ebayAccountId gerekli" }, { status: 400 });
    }
    const { ebayAccountId, limit } = parsed.data;

    const account = await prisma.ebayAccount.findFirst({
      where: { id: ebayAccountId, userId },
      select: { id: true, productLimit: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
    }

    // PAKET = MAĞAZA: takip kotası bu mağazanın paketine özeldir (maliyet tavanı).
    // Zaten doğrulanmış (confirmed) kadarı düşülür.
    const productLimit = account.productLimit;
    const confirmedCount = await prisma.importedListing.count({
      where: { ebayAccountId, matchStatus: "confirmed" },
    });
    const remainingQuota = Math.max(0, productLimit - confirmedCount);
    const cap = Math.min(limit ?? remainingQuota, remainingQuota);

    if (cap <= 0) {
      return NextResponse.json({
        data: { enqueued: 0 },
        message: "Plan takip kotası dolu — doğrulanacak yeni ilan yok",
      });
    }

    // En eski "pending" ilanları al (ASIN'li, henüz doğrulanmamış)
    const pending = await prisma.importedListing.findMany({
      where: { ebayAccountId, matchStatus: "pending" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: cap,
    });

    // Stable jobId → tekrar tetiklemede çift iş oluşmaz (idempotent)
    await Promise.all(
      pending.map((p) =>
        verifyImportMatchQueue.add(
          "verify-import-match",
          { importedListingId: p.id },
          { jobId: `verify-import-match:${p.id}` }
        )
      )
    );

    return NextResponse.json({ data: { enqueued: pending.length, quotaRemaining: remainingQuota } });
  } catch (err) {
    console.error("[ebay/import/verify POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
