// Radar için tekil ioredis istemcisi (satıcı profili + denetim). BullMQ'nun dahili
// bağlantısından AYRI, ham ioredis. Yalnız WORKER runtime'ında kullanılır.
//
// Build güvenliği: lazyConnect=true → ilk komuta kadar bağlanmaz; ayrıca build
// fazında null döner (next build sırasında Redis adresi çözülemez).

import Redis from "ioredis";
import type { RadarRedis } from "@/lib/radar/seller-profile";

let client: Redis | null = null;

const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

/** Radar Redis istemcisi (lazy singleton). Build fazında null. */
export function getRadarRedis(): RadarRedis | null {
  if (IS_BUILD) return null;
  if (client) return client;
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
    // Bağlantı hatasında worker'ı çökertme — komutlar reddedilir, çağıran yakalar.
    retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 1000)),
  });
  client.on("error", () => {
    /* sessiz — radar profili/denetimi kritik değil, scan metin-only devam eder */
  });
  return client;
}
