/**
 * AliExpress Open Platform (Dropshipper API) istemcisi.
 *
 * Kurulum (resmi akış — openservice.aliexpress.com):
 *   1. Geliştirici ol → uygulama oluştur → App Key + App Secret al
 *   2. "Dropshipping API" iznine başvur (onay 2-5 gün)
 *   3. OAuth (authorization code) ile access_token + refresh_token al
 *
 * İmzalama: tüm parametreler (app_key, timestamp(ms), sign_method, access_token + iş paramları)
 * anahtara göre A→Z sıralanır, "key+value" şeklinde birleştirilir, app_secret ile HMAC-SHA256
 * alınır, HEX-UPPERCASE sonuç "sign" olarak gönderilir. (sign_method=sha256)
 *
 * Not: Onaylı DS metod adları hesaba göre küçük farklılık gösterebilir; aşağıdaki sabitler
 * tek yerde — canlı testte gerekirse buradan düzeltilir.
 */

import { createHmac } from "crypto";
import type { AliStockStatus } from "@/lib/amazon-repricer";
import { fetchAliExpressProductViaScraper } from "@/lib/aliexpress-scraper";

// Yeni global gateway (System Tools /sync uç noktası)
const ALI_GATEWAY = process.env.ALIEXPRESS_GATEWAY ?? "https://api-sg.aliexpress.com/sync";

// DS metod adları (canlı testte doğrulanır)
const M_PRODUCT = "aliexpress.ds.product.get";
const M_TRACKING = "aliexpress.ds.order.tracking.get";
const M_PLACE_ORDER = "aliexpress.trade.buy.placeorder";
const M_TOKEN_REFRESH = "/auth/token/refresh";

// NOT: Ürün KEŞFİ (radar aday havuzu) artık bu projede DEĞİL — Radar projesine
// (urun-radari) taşındı. Burası sadece İŞLETME: fiyat/stok çekme, sipariş, takip.

export interface AliProductData {
  costUsd: number;
  shippingUsd: number;
  stockStatus: AliStockStatus;
  stockQty: number | null;
  title?: string;
}

export function isAliExpressConfigured(): boolean {
  return Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_ACCESS_TOKEN);
}

function getCreds(): { appKey: string; appSecret: string; accessToken: string } {
  const appKey = process.env.ALIEXPRESS_APP_KEY;
  const appSecret = process.env.ALIEXPRESS_APP_SECRET;
  const accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN;
  if (!appKey || !appSecret || !accessToken) {
    throw new Error(
      "AliExpress yapılandırılmadı: ALIEXPRESS_APP_KEY / APP_SECRET / ACCESS_TOKEN .env'de yok"
    );
  }
  return { appKey, appSecret, accessToken };
}

/** AliExpress imzası: sıralı "key+value" birleşimi → HMAC-SHA256(secret) → HEX-UPPER. */
function sign(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params).sort();
  const base = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", appSecret).update(base, "utf8").digest("hex").toUpperCase();
}

/** İmzalı POST çağrısı (System Tools /sync). */
async function callAli<T = unknown>(
  method: string,
  bizParams: Record<string, string>,
  opts?: { withToken?: boolean }
): Promise<T> {
  const { appKey, appSecret, accessToken } = getCreds();

  const params: Record<string, string> = {
    method,
    app_key: appKey,
    timestamp: String(Date.now()),
    sign_method: "sha256",
    ...bizParams,
  };
  if (opts?.withToken !== false) params.access_token = accessToken;

  params.sign = sign(params, appSecret);

  const res = await fetch(ALI_GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });

  if (!res.ok) throw new Error(`AliExpress API hatası [${method}]: ${res.status}`);
  const data = (await res.json()) as { error_response?: { msg?: string; code?: string } };
  if (data.error_response) {
    throw new Error(`AliExpress hata: ${data.error_response.code} ${data.error_response.msg ?? ""}`);
  }
  return data as T;
}

/** AliExpress'in verdiği stok metnini standart duruma çevirir. */
function parseStock(raw: unknown): { status: AliStockStatus; qty: number | null } {
  const qty = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(qty)) return { status: "unknown", qty: null };
  if (qty <= 0) return { status: "out", qty: 0 };
  if (qty < 3) return { status: "low", qty };
  return { status: "in_stock", qty };
}

/**
 * Bir AliExpress ürününün güncel fiyat + stoğunu çeker.
 * @throws kaynak bağlı değilse.
 */
export async function fetchAliExpressProduct(aliId: string): Promise<AliProductData> {
  if (!isAliExpressConfigured()) {
    // Resmi API henüz onaylanmadı (başvuru sürecinde) — ScrapingBee ile geçici çözüm.
    // API onaylanıp .env'e eklenince isAliExpressConfigured() true döner, kod
    // değişikliği GEREKMEDEN resmi (ücretsiz) API'ye otomatik geçilir.
    return fetchAliExpressProductViaScraper(aliId);
  }

  // aliexpress.ds.product.get → fiyat + stok. Yanıt şeması canlı testte teyit edilir;
  // savunmacı parse: yaygın alan adlarını dener.
  const resp = await callAli<Record<string, unknown>>(M_PRODUCT, {
    product_id: aliId,
    ship_to_country: process.env.ALIEXPRESS_SHIP_TO ?? "US",
    target_currency: "USD",
    target_language: "en",
  });

  // Yanıtı esnek çöz (sürüm farklarına dayanıklı)
  const root = (resp as Record<string, unknown>);
  const result =
    (root["aliexpress_ds_product_get_response"] as Record<string, unknown>)?.["result"] ??
    (root["result"] as Record<string, unknown>) ??
    root;
  const r = result as Record<string, unknown>;

  const costUsd = Number(r["target_sale_price"] ?? r["sale_price"] ?? r["min_price"] ?? 0);
  const shippingUsd = Number(r["ship_cost"] ?? 0);
  const stock = parseStock(r["product_quantity"] ?? r["stock"] ?? r["available_qty"]);
  const title = typeof r["subject"] === "string" ? (r["subject"] as string) : undefined;

  if (!Number.isFinite(costUsd) || costUsd <= 0) {
    throw new Error(`AliExpress fiyatı çözülemedi (aliId ${aliId})`);
  }

  return { costUsd, shippingUsd, stockStatus: stock.status, stockQty: stock.qty, title };
}

/** Access token'ı refresh token ile yeniler (cron/worker tarafından kullanılır). */
export async function refreshAliExpressToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const resp = await callAli<Record<string, unknown>>(
    M_TOKEN_REFRESH,
    { refresh_token: refreshToken },
    { withToken: false }
  );
  const r = resp as Record<string, unknown>;
  const accessToken = String(r["access_token"] ?? "");
  const expiresIn = Number(r["expires_in"] ?? 0);
  if (!accessToken) throw new Error("AliExpress token yenileme başarısız");
  return { accessToken, expiresIn };
}

/** AliExpress'e dropshipping siparişi verir (sipariş-anı; canlı testte zenginleştirilecek). */
export async function placeAliExpressOrder(input: {
  productId: string;
  skuAttr?: string;
  quantity: number;
  address: Record<string, string>;
}): Promise<{ aliOrderId: string }> {
  const resp = await callAli<Record<string, unknown>>(M_PLACE_ORDER, {
    param_place_order_request4_open_api_d_t_o: JSON.stringify({
      product_items: [
        { product_id: input.productId, product_count: input.quantity, sku_attr: input.skuAttr ?? "" },
      ],
      logistics_address: input.address,
    }),
  });
  const r = resp as Record<string, unknown>;
  const aliOrderId = String(r["order_list"] ?? r["order_id"] ?? "");
  if (!aliOrderId) throw new Error("AliExpress sipariş oluşturulamadı");
  return { aliOrderId };
}

/** AliExpress sipariş kargo takip numarasını çeker (Cainiao no — sonra 17track ile çevrilir). */
export async function getAliExpressTracking(aliOrderId: string): Promise<{ trackingNo: string | null }> {
  const resp = await callAli<Record<string, unknown>>(M_TRACKING, { order_id: aliOrderId });
  const r = resp as Record<string, unknown>;
  const trackingNo =
    (r["mail_no"] as string) ?? (r["tracking_number"] as string) ?? null;
  return { trackingNo };
}
