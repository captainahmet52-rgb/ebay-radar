// AmazonBot oto-yükleme worker — depo kazananlarını müşteri kurallarıyla listeler.
// userId verilmezse oto-yükleme açık TÜM kullanıcılar işlenir.
import { Worker, Job } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AMAZON_MARKETS,
  getReferralRate,
  resolveMargin,
  userMarginForMarket,
  calculateAmazonPrice,
} from "@/lib/amazon-repricer";
import { createOrUpdateAmazonListing } from "@/lib/amazon-listings";
import { isSpapiConfigured } from "@/lib/amazon-spapi";
import type { AmazonAutoUploadJobData } from "@/lib/queues";
import { shouldRunScheduledUpload, type AutoUploadSchedule } from "@/lib/auto-upload-schedule";

interface UploadCounts {
  uploaded: number;
  skipped: number;
  checked: number;
}

async function uploadForUser(userId: string, log: (m: string) => void): Promise<UploadCounts | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { amazonAccounts: true },
  });
  if (!user || !user.amazonAutoUploadEnabled) return null;
  if (user.amazonAccounts.length === 0) {
    log(`Kullanıcı ${userId}: Amazon hesabı yok — atlanıyor`);
    return { uploaded: 0, skipped: 0, checked: 0 };
  }

  const totals: UploadCounts = { uploaded: 0, skipped: 0, checked: 0 };

  for (const account of user.amazonAccounts) {
    const market = account.market;
    const marketCfg = AMAZON_MARKETS[market];
    if (!marketCfg) continue;

    const margin = resolveMargin(marketCfg, userMarginForMarket(market, user));

    // Bu hesapta henüz listelenmemiş, kurallara uyan depo kazananları
    const products = await prisma.amazonDepotProduct.findMany({
      where: {
        status: "active",
        brandSafe: true,
        aliCostUsd: { gte: user.amazonUploadMinCostUsd, lte: user.amazonUploadMaxCostUsd },
        listings: { none: { amazonAccountId: account.id } },
      },
      orderBy: { radarScore: "desc" },
      take: user.amazonUploadDailyLimit,
    });

    log(`Hesap ${account.id} (${market}): ${products.length} aday yüklenecek`);
    totals.checked += products.length;

    for (const product of products) {
      const referralRate = getReferralRate(product.category);
      const pricing = calculateAmazonPrice(
        product.aliCostUsd,
        product.aliShippingUsd,
        referralRate,
        marketCfg,
        margin
      );
      const qty = user.amazonUploadQuantity;

      // DB listeleme kaydı (unique: amazonAccountId+productId → çift kayıt yok).
      // Yarış durumunda (iki worker aynı ürünü) P2002 → bu ürünü atla, job ÇÖKMESİN.
      let listing;
      try {
        listing = await prisma.amazonListing.create({
          data: {
            userId,
            amazonAccountId: account.id,
            productId: product.id,
            market,
            salePrice: pricing.salePrice,
            currentQty: qty,
            status: "active",
            publishStage: "draft",
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          totals.skipped++;
          continue; // zaten listelenmiş — atla
        }
        throw err;
      }
      totals.uploaded++;

      // Otomatik yayın açıksa ve SP-API hazırsa Amazon'a gönder
      if (user.amazonUploadAutoPublish && isSpapiConfigured()) {
        try {
          const res = await createOrUpdateAmazonListing(account, product, pricing.salePrice, qty);
          await prisma.amazonListing.update({
            where: { id: listing.id },
            data: { sku: res.sku, publishStage: "published", lastError: null },
          });
        } catch (err) {
          await prisma.amazonListing.update({
            where: { id: listing.id },
            data: {
              status: "paused",
              publishStage: "error",
              lastError: err instanceof Error ? err.message : String(err),
            },
          });
        }
      }
    }
  }

  return totals;
}

/** Çalıştırma sonucunu AmazonAutoUploadLog'a yazar — /amazon/auto-upload'daki geçmiş tablosu bunu okur. */
async function logRun(userId: string, counts: UploadCounts | null, errorMessage?: string): Promise<void> {
  await prisma.amazonAutoUploadLog
    .create({
      data: errorMessage
        ? { userId, status: "failed", errorMessage }
        : {
            userId,
            status: (counts?.uploaded ?? 0) > 0 ? "success" : "partial",
            productsUploaded: counts?.uploaded ?? 0,
            productsSkipped: counts?.skipped ?? 0,
            productsChecked: counts?.checked ?? 0,
          },
    })
    .catch(() => {});
}

async function runForUserWithLog(userId: string, log: (m: string) => void): Promise<void> {
  try {
    const counts = await uploadForUser(userId, log);
    if (counts) await logRun(userId, counts);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[amazon-auto-upload] kullanıcı ${userId} hata: ${msg}`);
    await logRun(userId, null, msg);
  }
}

/**
 * Kullanıcının KENDİ amazonUploadSchedule/amazonUploadScheduleHour tercihine
 * göre şu an sırası mı? (bkz. lib/auto-upload-schedule.ts — eBay ile aynı
 * desen, eskiden sabit 03:00 UTC TÜM kullanıcılar için çalışırdı.)
 */
async function dueForScheduledRun(
  userId: string,
  schedule: string,
  scheduleHour: number
): Promise<boolean> {
  const lastLog = await prisma.amazonAutoUploadLog.findFirst({
    where: { userId },
    orderBy: { ranAt: "desc" },
    select: { ranAt: true },
  });
  return shouldRunScheduledUpload(
    schedule as AutoUploadSchedule,
    scheduleHour,
    lastLog?.ranAt ?? null,
    new Date()
  );
}

async function processAmazonAutoUpload(job: Job<AmazonAutoUploadJobData>): Promise<void> {
  const log = (m: string) => { void job.log(m).catch(() => {}); };

  if (job.data.userId) {
    await runForUserWithLog(job.data.userId, log);
    return;
  }

  // Toplu: oto-yükleme açık kullanıcılardan sadece zamanlaması gelenler.
  const candidates = await prisma.user.findMany({
    where: { amazonAutoUploadEnabled: true },
    select: { id: true, amazonUploadSchedule: true, amazonUploadScheduleHour: true },
  });
  const due: string[] = [];
  for (const u of candidates) {
    if (await dueForScheduledRun(u.id, u.amazonUploadSchedule, u.amazonUploadScheduleHour)) due.push(u.id);
  }
  log(`${candidates.length} kullanıcıdan ${due.length}'i zamanlamasına göre çalışacak`);
  for (const id of due) {
    await runForUserWithLog(id, log);
  }
  // Depo doldurma artık Radar projesinin zamanlanmış taramasında (yerel tetikleme yok).
}

export function createAmazonAutoUploadWorker(connection: ConnectionOptions): Worker {
  const worker = new Worker<AmazonAutoUploadJobData>(
    "amazon-auto-upload",
    processAmazonAutoUpload,
    { connection, concurrency: 2 }
  );

  worker.on("completed", (job) => {
    console.log(`[amazon-auto-upload] ✓ ${job.id} | user: ${job.data.userId ?? "ALL"}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[amazon-auto-upload] ✗ ${job?.id} | ${err.message}`);
  });
  worker.on("error", (err) => console.error("[amazon-auto-upload] worker hatası:", err));

  return worker;
}
