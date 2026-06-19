// BullMQ Queue tanımları — hem API route'ları hem worker bu modülü kullanır.
// BullMQ'nun kendi dahili ioredis'ini kullanıyoruz — dış ioredis import YOK.
// connection: URL string veya {host,port} config — type çakışmasını önler.

import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

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

// ─── Job veri tipleri ──────────────────────────────────────────────────────────
export interface PollProductJobData {
  productId: string;
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
export const pollProductQueue = new Queue<PollProductJobData, void, string>("poll-product", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5 sn → 10 sn → 20 sn
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const verifyOrderQueue = new Queue<VerifyOrderJobData, void, string>("verify-order", {
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

export const updateListingQueue = new Queue<UpdateListingJobData, void, string>(
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

export const pollOrdersQueue = new Queue<PollOrdersJobData, void, string>("poll-orders", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

// ─── Radar & Dağıtım Kuyrukları ────────────────────────────────────────────────
export interface RadarScanJobData {
  trackedStoreId: string;
}

export interface DistributeProductsJobData {
  userId?: string; // undefined ise tüm kullanıcılara dağıt
}

export const radarScanQueue = new Queue<RadarScanJobData, void, string>("radar-scan", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

export const distributeProductsQueue = new Queue<DistributeProductsJobData, void, string>(
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

// ─── AmazonBot Radar Kuyruğu (AliExpress → Amazon depo) ───────────────────────
export interface AmazonRadarScanJobData {
  market: string; // us | uk | ae | sa
}

export const amazonRadarScanQueue = new Queue<AmazonRadarScanJobData, void, string>(
  "amazon-radar-scan",
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  }
);

// ─── AmazonBot Oto-Yükleme Kuyruğu ─────────────────────────────────────────────
export interface AmazonAutoUploadJobData {
  userId?: string; // undefined → oto-yükleme açık tüm kullanıcılar
}

export const amazonAutoUploadQueue = new Queue<AmazonAutoUploadJobData, void, string>(
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

export const amazonPollProductQueue = new Queue<AmazonPollProductJobData, void, string>(
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

export const amazonVerifyOrderQueue = new Queue<AmazonVerifyOrderJobData, void, string>(
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

// ─── AmazonBot Depo Bekçisi (eşik altına düşünce radarı tetikler) ──────────────
export interface AmazonDepotWatchdogJobData {
  _trigger?: string;
}

export const amazonDepotWatchdogQueue = new Queue<AmazonDepotWatchdogJobData, void, string>(
  "amazon-depot-watchdog",
  {
    connection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
    },
  }
);

// ─── AmazonBot Sipariş Çekme Kuyruğu (SP-API getOrders) ────────────────────────
export interface AmazonPollOrdersJobData {
  amazonAccountId?: string; // undefined → tüm Amazon hesapları
}

export const amazonPollOrdersQueue = new Queue<AmazonPollOrdersJobData, void, string>(
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

export const refreshTokensQueue = new Queue<RefreshTokensJobData, void, string>(
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

export const dispatchPollsQueue = new Queue<DispatchPollsJobData, void, string>(
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

export const dispatchPollOrdersQueue = new Queue<DispatchPollOrdersJobData, void, string>(
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
