import { NextRequest } from "next/server";

/**
 * Basit, bağımlılıksız in-memory sabit-pencere (fixed-window) rate limiter.
 *
 * Auth endpoint'lerinde (kayıt / giriş) brute-force'u yavaşlatmak için.
 * Tek process içinde çalışır; çok-instance dağıtımda Redis'e taşınmalıdır.
 * (Bu projede ayrı bir Redis client export edilmediği için kasıtlı in-memory.)
 */

// Varsayılan auth limiti: 15 dakikada 5 deneme.
export const AUTH_RATE_LIMIT_MAX = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

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

/**
 * Verilen anahtar için sabit-pencere limitini değerlendirir ve sayacı artırır.
 */
export function rateLimit(
  key: string,
  max: number = AUTH_RATE_LIMIT_MAX,
  windowMs: number = AUTH_RATE_LIMIT_WINDOW_MS
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

/**
 * Reverse-proxy (nginx/Caddy/Traefik) arkasındaki gerçek istemci IP'sini çıkarır.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
