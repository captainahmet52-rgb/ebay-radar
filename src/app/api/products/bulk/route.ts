import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { pollProductQueue } from "@/lib/queues";
import { storeAccessState, STORE_TRIAL_PRODUCT_LIMIT } from "@/lib/store-access";
import { rateLimit } from "@/lib/rate-limit";
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
 try {
  // Toplu yükleme her ASIN için scraper işi tetikler → kota istismarını sınırla:
  // 5 dakikada en fazla 10 toplu yükleme isteği.
  const rl = rateLimit(`bulk:${userId}`, 10, 5 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Çok fazla toplu yükleme — biraz bekleyip tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

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

  // PAKET = MAĞAZA: ürün limiti bu mağazanın paketine özeldir; kullanım da yalnızca bu
  // mağazanın listing'leri üzerinden sayılır (kullanıcı-başına değil, mağaza-başına).
  const productLimit = account.productLimit;
  const usedCount = await prisma.listing.count({ where: { userId, ebayAccountId: account.id } });
  const remaining = Math.max(0, productLimit - usedCount);

  if (remaining === 0) {
    return NextResponse.json(
      { error: `Ürün limitine ulaştın (${productLimit}). Planını yükselt.`, needUpgrade: true },
      { status: 403 }
    );
  }

  // Deneme modundaki mağaza: bu mağazaya en fazla STORE_TRIAL_PRODUCT_LIMIT (50) ürün
  let effectiveRemaining = remaining;
  if (storeAccessState(account) === "trial") {
    const storeUsed = await prisma.listing.count({ where: { userId, ebayAccountId: account.id } });
    const storeRemaining = Math.max(0, STORE_TRIAL_PRODUCT_LIMIT - storeUsed);
    if (storeRemaining === 0) {
      return NextResponse.json(
        {
          error: `Ücretsiz denemede mağaza başına ${STORE_TRIAL_PRODUCT_LIMIT} ürün yükleyebilirsin. Daha fazlası için paket al.`,
          needUpgrade: true,
        },
        { status: 403 }
      );
    }
    effectiveRemaining = Math.min(remaining, storeRemaining);
  }

  // Bu kullanıcının zaten listelediği ürünleri atla (mükerrer önleme)
  const targetAsins = asins.slice(0, effectiveRemaining);
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
 } catch (err) {
  console.error("[products/bulk POST]", err);
  return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
 }
});
