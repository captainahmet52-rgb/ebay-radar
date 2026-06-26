import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { listingImportQueue } from "@/lib/queues";

const startSchema = z.object({
  ebayAccountId: z.string().min(1),
});

// Devam eden sayılan import durumları (yenisini başlatmadan önce kontrol edilir)
const IN_PROGRESS = ["pending", "fetching", "matching"];

// POST /api/ebay/import — bir mağaza için MEVCUT ilanları içe aktarmayı başlat (keşif fazı)
export const POST = requireAuth(async (req, { userId }) => {
  try {
    const body = await req.json().catch(() => null);
    const parsed = startSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "ebayAccountId gerekli" }, { status: 400 });
    }
    const { ebayAccountId } = parsed.data;

    // Mağaza bu kullanıcıya mı ait? (tenant izolasyonu)
    const account = await prisma.ebayAccount.findFirst({
      where: { id: ebayAccountId, userId },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Mağaza bulunamadı" }, { status: 404 });
    }

    // Zaten devam eden bir import varsa onu döndür (çift tetiklemeyi engelle)
    const existing = await prisma.listingImport.findFirst({
      where: { ebayAccountId, status: { in: IN_PROGRESS } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({ data: existing, alreadyRunning: true });
    }

    const imp = await prisma.listingImport.create({
      data: { userId, ebayAccountId, status: "pending", source: "getmyebayselling" },
    });

    await listingImportQueue.add(
      "listing-import",
      { importId: imp.id },
      { jobId: `listing-import:${imp.id}` }
    );

    return NextResponse.json({ data: imp });
  } catch (err) {
    console.error("[ebay/import POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});

// GET /api/ebay/import?ebayAccountId=... — import durumu + sayaçlar
export const GET = requireAuth(async (req, { userId }) => {
  try {
    const url = new URL(req.url);
    const ebayAccountId = url.searchParams.get("ebayAccountId");

    const imports = await prisma.listingImport.findMany({
      where: { userId, ...(ebayAccountId ? { ebayAccountId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ data: imports });
  } catch (err) {
    console.error("[ebay/import GET]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
