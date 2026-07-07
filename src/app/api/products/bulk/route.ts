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
// Tek istekte işlenecek üst sınır — hem nginx zaman aşımına karşı güvenlik payı
// hem "1000'de biri kaybolur mu" belirsizliğini "1000 üstü zaten kabul edilmez"
// netliğine çevirir (sessiz kesme yerine açık hata).
const MAX_BULK_ASINS = 1000;

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
 * Toplu ASIN/URL yükleme — 1000'e kadar ASIN TEK istekte, ASIN sayısından
 * BAĞIMSIZ sabit sayıda DB sorgusuyla işlenir (createMany + addBulk). Eskiden
 * her ASIN için 4 ayrı sorgu + sıralı await vardı; 1000 ASIN'de bu hem nginx'in
 * /api/ zaman aşımını (15sn) aşıp isteği yarıda keserdi hem de "önce ilk N tane
 * al, dupe kontrolünü SONRA yap" sırası yüzünden dupe'lerin açtığı boş yerler
 * hiç doldurulmazdı (arkadaki geçerli ASIN'ler sessizce atılırdı). Şimdi TÜM
 * ASIN'ler tek seferde dupe kontrolünden geçer, bütçeye göre sıralanır; elenen
 * her ASIN adıyla birlikte rapor edilir.
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
  if (asins.length > MAX_BULK_ASINS) {
    return NextResponse.json(
      {
        error: `Tek seferde en fazla ${MAX_BULK_ASINS} ASIN işlenebilir (${asins.length} bulundu). Listeyi bölüp tekrar dene.`,
      },
      { status: 400 }
    );
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
    const storeRemaining = Math.max(0, STORE_TRIAL_PRODUCT_LIMIT - usedCount);
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

  // ── Mevcut ürünleri TEK sorguda çek (ASIN sayısı kadar sorgu DEĞİL) ───────
  const existingProducts = await prisma.product.findMany({
    where: { asin: { in: asins } },
    select: { id: true, asin: true },
  });
  const productIdByAsin = new Map(existingProducts.map((p) => [p.asin, p.id]));

  // ── Bu kullanıcının bu ürünlerde zaten listesi var mı — TEK sorguda ───────
  const existingProductIds = existingProducts.map((p) => p.id);
  const ownedListings =
    existingProductIds.length > 0
      ? await prisma.listing.findMany({
          where: { userId, productId: { in: existingProductIds } },
          select: { productId: true },
        })
      : [];
  const ownedProductIds = new Set(ownedListings.map((l) => l.productId));

  // ── TÜM ASIN'ler önce dupe elenir, SONRA bütçeye göre sıralanır — dupe'lerin
  //    açtığı boşluk arkadaki geçerli ASIN'lerce doldurulur (eski koddaki kaçak yok).
  const skippedDupeAsins: string[] = [];
  const eligibleAsins: string[] = [];
  for (const asin of asins) {
    const productId = productIdByAsin.get(asin);
    if (productId && ownedProductIds.has(productId)) {
      skippedDupeAsins.push(asin);
    } else {
      eligibleAsins.push(asin);
    }
  }
  const addedAsins = eligibleAsins.slice(0, effectiveRemaining);
  const skippedLimitAsins = eligibleAsins.slice(effectiveRemaining);

  if (addedAsins.length === 0) {
    return NextResponse.json({
      ok: true,
      requested: asins.length,
      added: 0,
      skippedDupe: skippedDupeAsins.length,
      skippedLimit: skippedLimitAsins.length,
      skippedDupeAsins,
      skippedLimitAsins,
      remaining,
      productLimit,
    });
  }

  // ── Depoda hiç olmayan ASIN'leri TEK createMany'de yarat (ASIN sayısı kadar
  //    upsert DEĞİL). Yeni ürünler kullanıcının Amazon kaynak pazarıyla etiketlenir
  //    — Alman müşteri amazon.de ASIN'i eklerse fiyat/stok amazon.de'den taransın.
  //    (Mevcut ürünün pazarı değiştirilmez: global ürün tek pazarlıdır.)
  const brandNewAsins = addedAsins.filter((a) => !productIdByAsin.has(a));
  if (brandNewAsins.length > 0) {
    const userMarket = await prisma.user.findUnique({
      where: { id: userId },
      select: { uploadSourceMarket: true },
    });
    await prisma.product.createMany({
      data: brandNewAsins.map((asin) => ({
        asin,
        status: "active",
        pollTier: "normal",
        amazonMarket: userMarket?.uploadSourceMarket ?? "US",
      })),
      skipDuplicates: true, // yarış durumunda (aynı ASIN başka istekte oluştu) sessizce atla
    });
    // createMany id döndürmez — ASIN unique index'i üzerinden ucuza geri al
    const created = await prisma.product.findMany({
      where: { asin: { in: brandNewAsins } },
      select: { id: true, asin: true },
    });
    for (const p of created) productIdByAsin.set(p.asin, p.id);
  }

  // ── Listing'leri TEK createMany'de yarat ──────────────────────────────────
  await prisma.listing.createMany({
    data: addedAsins.map((asin) => ({
      userId,
      productId: productIdByAsin.get(asin)!,
      ebayAccountId: account.id,
      ebaySite: account.marketplace,
      marginPct: profitMarginPct,
      currentQty: stockQty,
      status: mode === "auto" ? "active" : "draft",
      publishStage: mode === "auto" ? "pending_publish" : "draft",
    })),
  });

  // ── Fiyat/stok çekimini TEK addBulk çağrısıyla kuyruğa yolla (staggered —
  //    İşlem Aralığı). 1000 ayrı .add() çağrısı yerine tek Redis round-trip.
  await pollProductQueue.addBulk(
    addedAsins.map((asin, i) => {
      const productId = productIdByAsin.get(asin)!;
      return {
        name: "poll-product",
        data: { productId },
        opts: { delay: i * intervalSec * 1000, jobId: `bulk-poll:${productId}:${Date.now()}:${i}` },
      };
    })
  );

  return NextResponse.json({
    ok: true,
    requested: asins.length,
    added: addedAsins.length,
    skippedDupe: skippedDupeAsins.length,
    skippedLimit: skippedLimitAsins.length,
    skippedDupeAsins,
    skippedLimitAsins,
    remaining: remaining - addedAsins.length,
    productLimit,
  });
 } catch (err) {
  console.error("[products/bulk POST]", err);
  return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
 }
});
