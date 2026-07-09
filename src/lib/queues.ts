// BullMQ Queue tanımları — hem API route'ları hem worker bu modülü kullanır.
// BullMQ'nun kendi dahili ioredis'ini kullanıyoruz — dış ioredis import YOK.
// connection: URL string veya {host,port} config — type çakışmasını önler.

import { Queue } from "bullmq";
import type { ConnectionOptions, QueueOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

function parseRedisUrl(url: string): ConnectionOptions {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as ConnectionOptions;
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null } as ConnectionOptions;
  }
}

export const connection = parseRedisUrl(redisUrl);

// KRİTİK — build sırasında Redis'e bağlanma.
// `next build`in "Collecting page data" aşaması API route modüllerini import eder;
// bu modüldeki her `new Queue()` BullMQ'yu Redis'e ZORLA bağlatır (BullMQ lazyConnect'i
// dinlemez). Build ortamında 'redis' adresi çözülemez → ENOTFOUND retry fırtınası →
// build exit 255 ile çöker. Next build sırasında NEXT_PHASE === "phase-production-build"
// olur; o anda gerçek Queue yerine, erişilirse hata fırlatan bir stub döndürürüz
// (build'de kuyruk metodu zaten çağrılmaz). Runtime'da (next start + worker süreci)
// NEXT_PHASE bu değer DEĞİLDİR → normal Queue oluşturulur ve çalışır.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function createQueue<D = unknown, R = unknown, N extends string = string>(
  name: string,
  opts: QueueOptions
): Queue<D, R, N> {
  if (IS_BUILD) {
    return new Proxy({} as Queue<D, R, N>, {
      get(_target, prop) {
        throw new Error(
          `BullMQ kuyruğu '${name}' build aşamasında kullanılamaz (erişilen: ${String(prop)})`
        );
      },
    });
  }
  return new Queue<D, R, N>(name, opts);
}

// ─── Job veri tipleri ──────────────────────────────────────────────────────────
export interface PollProductJobData {
  productId: string;
  // true → duraklatılmış ürünü yeniden değerlendir (auto-recovery)
  recovery?: boolean;
}

export interface VerifyOrderJobData {
  orderId: string;
}

export interface UpdateListingJobData {
  listingId: string;
  price: number;
  qty: number;
}

export interface PollOrdersJobData {
  ebayAccountId: string;
}

// ─── Kuyruklar ─────────────────────────────────────────────────────────────────
// 3. generic param (NameType) açıkça string — ExtractNameType string literal hatasını önler
export const pollProductQueue = createQueue<PollProductJobData, void, string>("poll-product", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5 sn → 10 sn → 20 sn
    },
    // Stable jobId (poll-product:<id>) kullanılıyor; tamamlanan job HEMEN silinmeli ki
    // bir sonraki tarama turunda aynı ürün tekrar kuyruğa eklenebilsin (tıkanma önleme).
    removeOnComplete: true,
    removeOnFail: { count: 500 },
  },
});

export const verifyOrderQueue = createQueue<VerifyOrderJobData, void, string>("verify-order", {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 3000,
    },
    // Sipariş doğrulama kritik — fail joblar uzun süre saklanır
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 1000 },
  },
});

export const updateListingQueue = createQueue<UpdateListingJobData, void, string>(
  "update-listing",
  {
    connection,
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  }
);

export const pollOrdersQueue = createQueue<PollOrdersJobData, void, string>("poll-orders", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    // Stable jobId (poll-orders:<accountId>) kullanılıyor. Tamamlanan job geçmişte
    // tutulursa (count: 100) aynı jobId tekrar EKLENEMEZ → sonraki dispatch turunda
    // o hesabın siparişleri ÇEKİLMEZ = sipariş çekme tıkanır. pollProductQueue gibi
    // tamamlananı HEMEN sil ki her tur tekrar enqueue edilebilsin.
    removeOnComplete: true,
    removeOnFail: { count: 500 },
  },
});

// ─── Dağıtım Kuyruğu ───────────────────────────────────────────────────────────
export interface DistributeProductsJobData {
  userId?: string; // undefined ise tüm kullanıcılara dağıt
}

export const distributeProductsQueue = createQueue<DistributeProductsJobData, void, string>(
  "distribute-products",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

// NOT: AmazonBot RADAR kuyruğu (amazon-radar-scan) KALDIRILDI — keşif/skorlama
// Radar projesine (urun-radari) taşındı; kazananlar /api/amazon-depot/intake ile gelir.

// ─── AmazonBot Oto-Yükleme Kuyruğu ─────────────────────────────────────────────
export interface AmazonAutoUploadJobData {
  userId?: string; // undefined → oto-yükleme açık tüm kullanıcılar
}

export const amazonAutoUploadQueue = createQueue<AmazonAutoUploadJobData, void, string>(
  "amazon-auto-upload",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

// ─── AmazonBot Stok/Fiyat Tarama Kuyruğu ───────────────────────────────────────
export interface AmazonPollProductJobData {
  depotProductId: string;
}

export const amazonPollProductQueue = createQueue<AmazonPollProductJobData, void, string>(
  "amazon-poll-product",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  }
);

// ─── AmazonBot Sipariş-Anı Doğrulama (canlı stok/fiyat kontrolü) ──────────────
export interface AmazonVerifyOrderJobData {
  orderId: string;
}

export const amazonVerifyOrderQueue = createQueue<AmazonVerifyOrderJobData, void, string>(
  "amazon-verify-order",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 3000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  }
);

// ─── AmazonBot Oto-Sipariş (AliExpress'e oto-buy) ──────────────────────────────
export interface AmazonFulfillOrderJobData {
  orderId: string;
}

export const amazonFulfillOrderQueue = createQueue<AmazonFulfillOrderJobData, void, string>(
  "amazon-fulfill-order",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 8000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  }
);

// ─── AmazonBot Takip Senkronu (AliExpress sipariş → kargo no çek) ──────────────
export interface AmazonTrackingSyncJobData {
  _trigger?: string;
}

export const amazonTrackingSyncQueue = createQueue<AmazonTrackingSyncJobData, void, string>(
  "amazon-tracking-sync",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  }
);

// NOT: AmazonBot Depo Bekçisi (amazon-depot-watchdog) KALDIRILDI — depo doldurma
// artık Radar projesinin zamanlanmış taramasıyla olur (yerelden radar tetiklenmez).

// ─── AmazonBot Sipariş Çekme Kuyruğu (SP-API getOrders) ────────────────────────
export interface AmazonPollOrdersJobData {
  amazonAccountId?: string; // undefined → tüm Amazon hesapları
}

export const amazonPollOrdersQueue = createQueue<AmazonPollOrdersJobData, void, string>(
  "amazon-poll-orders",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 300 },
    },
  }
);

// ─── Token Yenileme Kuyruğu ────────────────────────────────────────────────────
export interface RefreshTokensJobData {
  ebayAccountId?: string; // undefined ise süresi yaklaşan tüm hesapları yenile
}

export const refreshTokensQueue = createQueue<RefreshTokensJobData, void, string>(
  "refresh-tokens",
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

// ─── Dispatch Kuyrukları (Scheduler tarafından tetiklenir) ────────────────────

export interface DispatchPollsJobData {
  _trigger?: string; // boş data, sadece tetikleyici
}

export const dispatchPollsQueue = createQueue<DispatchPollsJobData, void, string>(
  "dispatch-polls",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  }
);

export interface DispatchPollOrdersJobData {
  _trigger?: string;
}

export const dispatchPollOrdersQueue = createQueue<DispatchPollOrdersJobData, void, string>(
  "dispatch-poll-orders",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  }
);

// ── ebay-auto-upload: oto-yükleme açık kullanıcılara depodan ürün listeler ──
export interface EbayAutoUploadJobData {
  userId?: string; // verilmezse tüm açık kullanıcılar
}

export const ebayAutoUploadQueue = createQueue<EbayAutoUploadJobData, void, string>(
  "ebay-auto-upload",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
    },
  }
);

// ── publish-listing: yeni listing'i eBay'e API ile yayınlar (inventory→offer→publish) ──
export interface PublishListingJobData {
  listingId: string;
  ebayAccountId: string;
}

export const publishListingQueue = createQueue<PublishListingJobData, void, string>(
  "publish-listing",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

// ── retier-products: satış-hızına göre tarama grubu (hot/normal/dead) ayarlar ──
export interface RetierProductsJobData {
  _trigger?: string;
}

export const retierProductsQueue = createQueue<RetierProductsJobData, void, string>(
  "retier-products",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  }
);

// ── scraper-usage-check: ScrapingBee kotası %80'i geçince admin'i UYARIR ──
export interface ScraperUsageCheckJobData {
  _trigger?: string;
}

export const scraperUsageCheckQueue = createQueue<ScraperUsageCheckJobData, void, string>(
  "scraper-usage-check",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  }
);

// ── freeze-stores: süresi biten (deneme/paket) mağazaları otomatik dondurur ──
export interface FreezeStoresJobData {
  _trigger?: string;
}

export const freezeStoresQueue = createQueue<FreezeStoresJobData, void, string>(
  "freeze-stores",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  }
);

// ── listing-import: satıcının MEVCUT eBay ilanlarını çek (Trading API keşif fazı) ──
export interface ListingImportJobData {
  importId: string;
}

export const listingImportQueue = createQueue<ListingImportJobData, void, string>(
  "listing-import",
  {
    connection,
    defaultJobOptions: {
      // Keşif uzun sürebilir (10k-100k ilan, sayfalı). Sayfa imleci ile resume edilir,
      // o yüzden az deneme + uzun backoff.
      attempts: 2,
      backoff: { type: "fixed", delay: 15000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  }
);

// ── verify-import-match: tek ImportedListing'i Amazon'dan doğrula (SIFIR HATA) ──
export interface VerifyImportMatchJobData {
  importedListingId: string;
}

export const verifyImportMatchQueue = createQueue<VerifyImportMatchJobData, void, string>(
  "verify-import-match",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 200 },
      removeOnFail: { count: 500 },
    },
  }
);
