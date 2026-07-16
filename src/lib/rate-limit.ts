import { NextRequest } from "next/server";
import Redis from "ioredis";

/**
 * Rate limiter — kalıcı (Redis) tercih edilir, Redis yoksa/erişilemezse in-memory'ye düşer.
 *
 * Neden Redis: in-memory sayaç HER DEPLOY'da sıfırlanır ve tek process'e özgüdür
 * (worker + app + çok-instance kapsanmaz). Redis-tabanlı sayaç deploy'lardan ve
 * process sınırlarından etkilenmez → auth brute-force'a karşı gerçek koruma.
 *
 * Fail-open: Redis hatasında istek engellenmez, in-memory fallback devreye girer
 * (limiter yüzünden meşru trafiği kesmemek için).
 */

// Varsayılan auth limiti: 15 dakikada 5 deneme.
export const AUTH_RATE_LIMIT_MAX = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Login denemesi (IP başına): 15 dakikada 10 — meşru yanlış-şifre payı bırakır,
// otomatik brute-force'u durdurur.
export const LOGIN_RATE_LIMIT_MAX = 10;

interface WindowState {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

// ─── In-memory (fallback + senkron kullanım) ─────────────────────────────────
/** Sabit-pencere limitini in-memory değerlendirir ve sayacı artırır (SENKRON). */
export function rateLimit(
  key: string,
  max: number = AUTH_RATE_LIMIT_MAX,
  windowMs: number = AUTH_RATE_LIMIT_WINDOW_MS,
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || now >= existing.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  const next: WindowState = { count: existing.count + 1, resetAt: existing.resetAt };
  store.set(key, next);
  return { allowed: true, remaining: max - next.count, retryAfterSeconds: 0 };
}

// ─── Redis (kalıcı) ──────────────────────────────────────────────────────────
let redis: Redis | null = null;
let redisInit = false;
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

function getRedis(): Redis | null {
  if (IS_BUILD) return null;
  if (redisInit) return redis;
  redisInit = true;
  try {
    redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 3 ? null : 200),
    });
    redis.on("error", () => {
      /* sessiz — fail-open, in-memory fallback devreye girer */
    });
  } catch {
    redis = null;
  }
  return redis;
}

/**
 * Rate limitini KALICI (Redis) sayaçla değerlendirir. Redis erişilemezse in-memory
 * fallback'e düşer (fail-open). Route handler'larda bunu kullan.
 */
export async function rateLimitAsync(
  key: string,
  max: number = AUTH_RATE_LIMIT_MAX,
  windowMs: number = AUTH_RATE_LIMIT_WINDOW_MS,
): Promise<RateLimitResult> {
  const r = getRedis();
  if (r) {
    try {
      const rkey = `rl:${key}`;
      const count = await r.incr(rkey);
      if (count === 1) {
        await r.pexpire(rkey, windowMs);
      }
      let ttl = await r.pttl(rkey);
      if (ttl < 0) {
        // TTL yoksa (nadir yarış) yeniden kur
        await r.pexpire(rkey, windowMs);
        ttl = windowMs;
      }
      if (count > max) {
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(ttl / 1000) };
      }
      return { allowed: true, remaining: Math.max(0, max - count), retryAfterSeconds: 0 };
    } catch {
      /* Redis hatası → in-memory fallback */
    }
  }
  return rateLimit(key, max, windowMs);
}

// ─── Tek kullanımlık anahtar (nonce tüketimi) ────────────────────────────────
const onceStore = new Map<string, number>();

/**
 * Anahtarı atomik olarak "tüketir" — İLK çağrıda true, tekrarında (TTL içinde) false.
 * OAuth state nonce'u gibi tek-kullanımlık değerlerin tekrar oynatılmasını
 * (replay) engeller. Redis varsa SET NX (process/deploy sınırları aşılır),
 * yoksa in-memory düşüş.
 */
export async function consumeOnce(key: string, ttlMs: number): Promise<boolean> {
  const r = getRedis();
  if (r) {
    try {
      const res = await r.set(`once:${key}`, "1", "PX", ttlMs, "NX");
      return res === "OK";
    } catch {
      /* Redis hatası → in-memory fallback */
    }
  }
  const now = Date.now();
  // Süresi geçmiş girişleri temizle (sınırsız büyümesin)
  if (onceStore.size > 10_000) {
    for (const [k, exp] of onceStore) {
      if (exp <= now) onceStore.delete(k);
    }
  }
  const existing = onceStore.get(key);
  if (existing && existing > now) return false;
  onceStore.set(key, now + ttlMs);
  return true;
}

// ─── İstemci IP ──────────────────────────────────────────────────────────────
/**
 * Reverse-proxy arkasındaki gerçek istemci IP'sini Headers'tan çıkarır.
 *
 * SON girişi alırız, İLKİNİ DEĞİL: proxy'ler (Traefik/nginx) gördükleri istemci
 * IP'sini listenin SONUNA ekler. İlk girişler istemcinin kendisi tarafından
 * sahte gönderilebilir (rate-limit bypass) — son giriş bizim proxy'nin yazdığı,
 * güvenilir olan değerdir.
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Reverse-proxy arkasındaki gerçek istemci IP'sini NextRequest'ten çıkarır. */
export function getClientIp(req: NextRequest): string {
  return getClientIpFromHeaders(req.headers);
}
