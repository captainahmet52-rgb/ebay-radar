import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pollProductQueue } from "@/lib/queues";
import { z } from "zod";

const schema = z.object({
  input: z.string().min(1),
  profitMarginPct: z.number().min(0).max(90),
  stockQty: z.number().int().min(1).max(10),
  intervalSec: z.number().int().min(0).max(60).default(1),
  mode: z.enum(["auto", "draft"]),
  ebayAccountId: z.string().optional(),
});

const ASIN_RE = /\b([A-Z0-9]{10})\b/i;

/** Her satırdan ASIN çıkarır (URL veya ham), tekilleştirir. */
function parseAsins(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\n,]/)) {
    const line = raw.trim();
    if (!line) continue;
    // URL'den /dp/XXXX veya /gp/product/XXXX, yoksa ham 10 hane
    const m =
      line.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || line.match(ASIN_RE);
    if (m) seen.add(m[1].toUpperCase());
  }
  return Array.from(seen);
}

/**
 * POST /api/products/bulk
 * Toplu ASIN/URL yükleme: her ürün için Listing oluşturur, limitten DÜŞER,
 * fiyat/stok çekimini worker'a staggered olarak yollar.
 */
export const POST = requireAuth(async (req, { userId }) => {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }
  const { input, profitMarginPct, stockQty, intervalSec, mode } = parsed.data;

  const asins = parseAsins(input);
  if (asins.length === 0) {
    return NextResponse.json({ error: "Geçerli ASIN/URL bulunamadı" }, { status: 400 });
  }

  // eBay hesabı: SADECE aktif mağazalar (verilmişse o, yoksa ilk aktif mağaza)
  const account = parsed.data.ebayAccountId
    ? await prisma.ebayAccount.findFirst({ where: { id: parsed.data.ebayAccountId, userId, isActive: true } })
    : await prisma.ebayAccount.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: "asc" } });
  if (!account) {
    const hasAny = await prisma.ebayAccount.count({ where: { userId } });
    return NextResponse.json(
      {
        error: hasAny
          ? "Seçtiğin mağaza aktif değil. Mağazalarım'dan aktifleştir."
          : "Önce bir eBay mağazası bağla.",
        needActivation: hasAny > 0,
      },
      { status: 400 }
    );
  }

  // Limit: kullanılan = kullanıcının listing sayısı
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { productLimit: true } });
  const productLimit = user?.productLimit ?? 100;
  const usedCount = await prisma.listing.count({ where: { userId } });
  const remaining = Math.max(0, productLimit - usedCount);

  if (remaining === 0) {
    return NextResponse.json(
      { error: `Ürün limitine ulaştın (${productLimit}). Planını yükselt.`, needUpgrade: true },
      { status: 403 }
    );
  }

  // Bu kullanıcının zaten listelediği ürünleri atla (mükerrer önleme)
  const targetAsins = asins.slice(0, remaining);
  let added = 0;
  let skippedDupe = 0;

  for (let i = 0; i < targetAsins.length; i++) {
    const asin = targetAsins[i];
    // Depo ürününü oluştur/bul (fiyat/stok worker dolduracak)
    const product = await prisma.product.upsert({
      where: { asin },
      create: { asin, status: "active", pollTier: "normal" },
      update: {},
    });

    // Kullanıcının bu üründe zaten listesi var mı?
    const exists = await prisma.listing.findFirst({
      where: { userId, productId: product.id },
      select: { id: true },
    });
    if (exists) { skippedDupe++; continue; }

    await prisma.listing.create({
      data: {
        userId,
        productId: product.id,
        ebayAccountId: account.id,
        ebaySite: account.marketplace,
        marginPct: profitMarginPct,
        currentQty: stockQty,
        status: mode === "auto" ? "active" : "draft",
        publishStage: mode === "auto" ? "pending_publish" : "draft",
      },
    });
    added++;

    // Fiyat/stok çekimini worker'a yolla (staggered — İşlem Aralığı)
    await pollProductQueue.add(
      "poll-product",
      { productId: product.id },
      { delay: i * intervalSec * 1000, jobId: `bulk-poll:${product.id}:${Date.now()}` }
    );
  }

  return NextResponse.json({
    ok: true,
    requested: asins.length,
    added,
    skippedDupe,
    skippedLimit: Math.max(0, asins.length - remaining),
    remaining: remaining - added,
    productLimit,
  });
});
