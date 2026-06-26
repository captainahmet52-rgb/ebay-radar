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
import { triggerRadarIfLow } from "@/lib/amazon-depot";
import { isSpapiConfigured } from "@/lib/amazon-spapi";
import type { AmazonAutoUploadJobData } from "@/lib/queues";

async function uploadForUser(userId: string, log: (m: string) => void): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { amazonAccounts: true },
  });
  if (!user || !user.amazonAutoUploadEnabled) return;
  if (user.amazonAccounts.length === 0) {
    log(`Kullanıcı ${userId}: Amazon hesabı yok — atlanıyor`);
    return;
  }

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
          continue; // zaten listelenmiş — atla
        }
        throw err;
      }

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
}

async function processAmazonAutoUpload(job: Job<AmazonAutoUploadJobData>): Promise<void> {
  const log = (m: string) => { void job.log(m).catch(() => {}); };

  if (job.data.userId) {
    await uploadForUser(job.data.userId, log);
    return;
  }

  // Toplu: oto-yükleme açık tüm kullanıcılar
  const users = await prisma.user.findMany({
    where: { amazonAutoUploadEnabled: true },
    select: { id: true },
  });
  log(`Toplu oto-yükleme: ${users.length} kullanıcı`);
  for (const u of users) {
    await uploadForUser(u.id, log);
  }

  // Yükleme depoyu azalttıysa radarı hemen tetikle (yeni ürün gelsin)
  const { triggered, count } = await triggerRadarIfLow("oto-yükleme sonrası");
  if (triggered) log(`Depo azaldı (${count}) — radar tetiklendi`);
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
