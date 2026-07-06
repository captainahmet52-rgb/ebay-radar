// ebay-auto-upload worker — "bilmeyen adam" akışı.
// Oto-yükleme açık kullanıcılara, depodan (DepotProduct) filtrelerine
// uyan ürünleri seçer, Listing oluşturur ve poll-product kuyruğuna atar. poll-product
// güncel Amazon verisini çeker ve publish-listing ile eBay'e API'den YAYINLAR.
// Limitler: mağaza productLimit (paket = mağaza) + günlük uploadDailyLimit + deneme mağazasında 50.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { prisma } from "@/lib/prisma";
import { pollProductQueue, type EbayAutoUploadJobData } from "@/lib/queues";
import { storeAccessState, STORE_TRIAL_PRODUCT_LIMIT } from "@/lib/store-access";

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function processForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.autoUploadEnabled) return;

  // Aktif (erişimi olan) eBay mağazası — yoksa atla
  const account = await prisma.ebayAccount.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    await prisma.autoUploadLog.create({
      data: { userId, status: "failed", errorMessage: "Aktif eBay mağazası yok" },
    });
    return;
  }

  // Limitler — PAKET = MAĞAZA: ürün limiti bu mağazanın paketine özeldir (mağaza-başına).
  const totalListings = await prisma.listing.count({ where: { userId, ebayAccountId: account.id } });
  let remaining = Math.max(0, account.productLimit - totalListings);

  // Günlük limit
  const todayCount = await prisma.listing.count({
    where: { userId, createdAt: { gte: startOfToday() } },
  });
  remaining = Math.min(remaining, Math.max(0, user.uploadDailyLimit - todayCount));

  // Deneme mağazasında mağaza başına 50 ürün
  if (storeAccessState(account) === "trial") {
    const storeCount = await prisma.listing.count({
      where: { userId, ebayAccountId: account.id },
    });
    remaining = Math.min(remaining, Math.max(0, STORE_TRIAL_PRODUCT_LIMIT - storeCount));
  }

  if (remaining <= 0) {
    await prisma.autoUploadLog.create({
      data: { userId, status: "success", productsUploaded: 0, errorMessage: "Limit dolu" },
    });
    return;
  }

  // MÜNHASIRLIK: bir ürün YALNIZ BİR mağazaya yüklenir. Herhangi bir
  // kullanıcıda kapatılmamış listing'i olan ASIN havuzdan düşer — müşteriler
  // aynı ürünle eBay'de birbiriyle rekabet etmez. (Listing "ended" olursa
  // ASIN yeniden boşa çıkar ve başka mağazaya gidebilir.)
  const taken = await prisma.listing.findMany({
    where: { status: { not: "ended" } },
    select: { product: { select: { asin: true } } },
  });
  const takenAsins = new Set(taken.map((l) => l.product?.asin).filter(Boolean) as string[]);

  // Filtrelere uyan depo ürünleri.
  // "Son X günde satılmış" (uploadSoldWithinDays): DepotProduct.lastSoldAt
  // Radar'ın snapshot deltasından gelir — dün gerçekten satılan ürünü bugün
  // listelemek sipariş olasılığını en çok artıran sinyaldir (sıcak ürün).
  const soldCutoff = user.uploadSoldWithinDays
    ? new Date(Date.now() - user.uploadSoldWithinDays * 24 * 3600 * 1000)
    : null;
  const candidates = await prisma.depotProduct.findMany({
    where: {
      status: "active",
      amazonMarket: user.uploadSourceMarket,
      amazonPrice: { not: null, gte: user.uploadMinAmazonPrice, lte: user.uploadMaxAmazonPrice },
      ...(soldCutoff ? { lastSoldAt: { gte: soldCutoff } } : {}),
    },
    // En iyi ürün önce: kâr × talep skoru (rankScore), eşitse en yeni eklenen.
    orderBy: [{ rankScore: "desc" }, { createdAt: "desc" }],
    take: remaining * 3, // owned filtrelemesi için fazladan al
  });

  let uploaded = 0;
  let skipped = 0;
  let i = 0;
  for (const depot of candidates) {
    if (uploaded >= remaining) break;
    if (takenAsins.has(depot.asin)) { skipped++; continue; }

    // Depo ürününü Product'a yansıt (publish pipeline Product kullanır)
    const product = await prisma.product.upsert({
      where: { asin: depot.asin },
      create: {
        asin: depot.asin,
        title: depot.title,
        imageUrl: depot.imageUrl,
        category: depot.category,
        amazonMarket: depot.amazonMarket,
        amazonPrice: depot.amazonPrice,
        ebayFeeRate: depot.ebayFeeRate,
        status: "active",
        pollTier: "normal",
      },
      update: {},
    });

    // Zaten HERHANGİ BİR mağazada listesi var mı? (yarış koruması — münhasırlık)
    const dupe = await prisma.listing.findFirst({
      where: { productId: product.id, status: { not: "ended" } },
      select: { id: true },
    });
    if (dupe) { skipped++; continue; }

    await prisma.listing.create({
      data: {
        userId,
        productId: product.id,
        ebayAccountId: account.id,
        ebaySite: user.uploadEbaySite,
        marginPct: user.uploadProfitMarginPct,
        currentQty: user.uploadQuantity,
        status: "active",
        publishStage: "pending_publish",
      },
    });

    // Amazon verisi çek + eBay'e yayınla (staggered)
    await pollProductQueue.add(
      "poll-product",
      { productId: product.id },
      { delay: i * 1500, jobId: `auto-poll:${userId}:${product.id}:${Date.now()}` }
    );

    // Aynı çalıştırmada sonraki kullanıcılar bu ASIN'i almasın (münhasırlık)
    takenAsins.add(depot.asin);
    uploaded++;
    i++;
  }

  await prisma.autoUploadLog.create({
    data: {
      userId,
      status: uploaded > 0 ? "success" : "partial",
      productsUploaded: uploaded,
      productsSkipped: skipped,
      productsChecked: candidates.length,
    },
  });
}

async function processEbayAutoUpload(job: Job<EbayAutoUploadJobData>): Promise<void> {
  const { userId } = job.data;

  const users = userId
    ? [{ id: userId }]
    : await prisma.user.findMany({
        where: { autoUploadEnabled: true },
        select: { id: true },
      });

  await job.log(`${users.length} kullanıcı için oto-yükleme çalışıyor`);

  for (const u of users) {
    try {
      await processForUser(u.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[ebay-auto-upload] kullanıcı ${u.id} hata: ${msg}`);
      await prisma.autoUploadLog
        .create({ data: { userId: u.id, status: "failed", errorMessage: msg } })
        .catch(() => {});
    }
  }
}

export function createEbayAutoUploadWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<EbayAutoUploadJobData>(
    "ebay-auto-upload",
    processEbayAutoUpload,
    { connection, concurrency: 1 }
  );

  worker.on("completed", (job) => console.log(`[ebay-auto-upload] ✓ ${job.id}`));
  worker.on("failed", (job, err) =>
    console.error(`[ebay-auto-upload] ✗ ${job?.id} | ${err.message}`)
  );
  worker.on("error", (err) => console.error("[ebay-auto-upload] worker hatası:", err));

  return worker;
}
