// Lemon Squeezy entegrasyonu — Merchant of Record (kayıtlı satıcı) ödeme altyapısı.
//
// Neden MoR: kullanıcının kayıtlı şirketi yok; Lemon Squeezy yasal satıcı olarak
// tahsilatı, dünya çapında vergi/KDV/faturayı üstlenir, bize tedarikçi gibi öder.
// Kart bilgisi hiç bize değmez — checkout tamamen LS'te barındırılır.
//
// Model: PAKET = MAĞAZA. Her eBay mağazası KENDİ aboneliğine sahip. Checkout'a
// hangi mağaza (ebayAccountId) için alındığı `custom` olarak gömülür; ödeme/yenileme
// webhook'unda geri gelir ve o mağaza aktive/uzatılır.
//
// Gerekli env:
//   LEMONSQUEEZY_API_KEY        (gizli) — API anahtarı
//   LEMONSQUEEZY_WEBHOOK_SECRET (gizli) — webhook imza doğrulaması
//   LEMONSQUEEZY_STORE_ID       (ops.)  — verilmezse isimle çözülür
//   LEMONSQUEEZY_STORE_NAME     (ops.)  — varsayılan "LeanAutomation"

import crypto from "crypto";
import { PLANS, type PlanId } from "@/lib/plans";

const LS_API = "https://api.lemonsqueezy.com/v1";
const CACHE_MS = 5 * 60_000;

// ─── Fiyat → paket eşlemesi ──────────────────────────────────────────────────
// Her paketin aylık fiyatı BENZERSİZ; LS varyantını fiyatına (cent) göre eşleriz.
// Böylece variant ID'leri elle girmeye gerek kalmaz.
const PLAN_BY_PRICE_CENTS = new Map<number, PlanId>();
for (const p of Object.values(PLANS)) {
  PLAN_BY_PRICE_CENTS.set(Math.round(p.priceMonthly * 100), p.id);
}

// ─── Düşük seviye API yardımcıları ───────────────────────────────────────────
interface LsResource {
  id: string;
  attributes: Record<string, unknown>;
}
interface LsListResponse {
  data: LsResource[];
  included?: LsResource[];
}
interface LsSingleResponse {
  data: LsResource;
}

function apiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY tanımlı değil — ödeme yapılandırılmamış.");
  return key;
}

async function lsGet(path: string): Promise<LsListResponse> {
  const res = await fetch(`${LS_API}${path}`, {
    headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new Error(`Lemon Squeezy GET ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as LsListResponse;
}

async function lsPost(path: string, body: unknown): Promise<LsSingleResponse> {
  const res = await fetch(`${LS_API}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Lemon Squeezy POST ${path} → ${res.status} ${await res.text()}`);
  return (await res.json()) as LsSingleResponse;
}

// ─── Mağaza ID çözümü (env override, yoksa isimle) ───────────────────────────
let cachedStoreId: { id: string; at: number } | null = null;

export async function getStoreId(): Promise<string> {
  const envId = process.env.LEMONSQUEEZY_STORE_ID;
  if (envId) return envId;
  if (cachedStoreId && Date.now() - cachedStoreId.at < CACHE_MS) return cachedStoreId.id;

  const wantName = (process.env.LEMONSQUEEZY_STORE_NAME ?? "LeanAutomation").toLowerCase();
  const res = await lsGet("/stores");
  const store =
    res.data.find((s) => String(s.attributes.name ?? "").toLowerCase() === wantName) ?? res.data[0];
  if (!store) throw new Error("Lemon Squeezy mağazası bulunamadı (API anahtarını kontrol et).");

  cachedStoreId = { id: store.id, at: Date.now() };
  return store.id;
}

// ─── Paket → varyant ID eşlemesi (fiyata göre, önbellekli) ───────────────────
let cachedVariants: { map: Record<string, string>; at: number } | null = null;

async function getPlanVariantMap(): Promise<Record<string, string>> {
  if (cachedVariants && Date.now() - cachedVariants.at < CACHE_MS) return cachedVariants.map;

  const storeId = await getStoreId();
  const res = await lsGet(`/products?filter[store_id]=${storeId}&include=variants`);
  const map: Record<string, string> = {};
  for (const v of res.included ?? []) {
    const priceCents = Number(v.attributes.price);
    if (!Number.isFinite(priceCents)) continue;
    const planId = PLAN_BY_PRICE_CENTS.get(priceCents);
    if (planId && !map[planId]) map[planId] = v.id;
  }
  cachedVariants = { map, at: Date.now() };
  return map;
}

export async function getVariantIdForPlan(planId: PlanId): Promise<string> {
  const map = await getPlanVariantMap();
  const variantId = map[planId];
  if (!variantId) {
    throw new Error(
      `'${planId}' paketi için Lemon Squeezy varyantı bulunamadı — panelde bu fiyatta abonelik ürünü var mı?`
    );
  }
  return variantId;
}

// ─── Checkout oluşturma ──────────────────────────────────────────────────────
export interface CheckoutCustom {
  ebayAccountId: string;
  userId: string;
  plan: string;
}

/** Barındırılan LS ödeme sayfası URL'i üretir (kullanıcı oraya yönlendirilir). */
export async function createCheckoutUrl(params: {
  planId: PlanId;
  email: string;
  custom: CheckoutCustom;
  redirectUrl: string;
}): Promise<string> {
  const [storeId, variantId] = await Promise.all([
    getStoreId(),
    getVariantIdForPlan(params.planId),
  ]);

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          email: params.email || undefined,
          // custom değerler LS'e string gider, webhook'ta meta.custom_data olarak döner.
          custom: {
            ebay_account_id: params.custom.ebayAccountId,
            user_id: params.custom.userId,
            plan: params.custom.plan,
          },
        },
        product_options: {
          redirect_url: params.redirectUrl,
        },
      },
      relationships: {
        store: { data: { type: "stores", id: storeId } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await lsPost("/checkouts", body);
  const url = res.data.attributes.url;
  if (typeof url !== "string") throw new Error("Lemon Squeezy checkout URL dönmedi.");
  return url;
}

// ─── Webhook imza doğrulaması (HMAC-SHA256, X-Signature header) ───────────────
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(digest, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
