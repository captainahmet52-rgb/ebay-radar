// eBay Sell Fulfillment API orkestrasyonu
//
// Üç işlev:
//   getNewOrders             — işlenmemiş (NOT_STARTED) siparişleri çeker
//   cancelOrder              — siparişi iptal eder (out-of-stock vb.)
//   createShippingFulfillment — kargo/tracking ekler, fulfillmentId döner
//
// Güvenlik: token/secret ASLA log'a veya hata mesajına yazılmaz.
// Token her zaman getValidToken üzerinden alınır (gerekirse otomatik yenilenir).
// 401 alınırsa EbayClient onRefresh ile token'ı tazeler.

import { EbayClient } from "@/lib/ebay/client";
import { getValidToken } from "@/lib/ebay/oauth";

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Alıcı kargo adresi (PII — managed fulfillment için Amazon'dan alırken gerekir) */
export interface EbayShipTo {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
}

/** poll-orders'ın ihtiyaç duyduğu sadeleştirilmiş sipariş şekli */
export interface EbayOrder {
  orderId: string;
  lineItems: Array<{ sku?: string; listingId?: string; lineItemId: string }>;
  /** totalFeeBasisAmount.value — komisyon/kâr hesabı için */
  totalAmount?: string;
  buyerUsername?: string;
  shipTo?: EbayShipTo;
}

// ─── eBay API ham yanıt şekilleri ──────────────────────────────────────────────

interface EbayAmount {
  value?: string;
  currency?: string;
}

interface EbayLineItem {
  lineItemId?: string;
  sku?: string;
  legacyItemId?: string; // marketplace listing ID
}

interface EbayContactAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateOrProvince?: string;
  postalCode?: string;
  countryCode?: string;
}

interface EbayShipToRaw {
  fullName?: string;
  contactAddress?: EbayContactAddress;
  primaryPhone?: { phoneNumber?: string };
}

interface EbayFulfillmentStartInstruction {
  shippingStep?: { shipTo?: EbayShipToRaw };
}

interface EbayRawOrder {
  orderId?: string;
  lineItems?: EbayLineItem[];
  totalFeeBasisAmount?: EbayAmount;
  buyer?: { username?: string };
  fulfillmentStartInstructions?: EbayFulfillmentStartInstruction[];
}

interface GetOrdersResponse {
  orders?: EbayRawOrder[];
  total?: number;
}

interface ShippingFulfillmentResponse {
  fulfillmentId?: string;
}

// ─── İptal sebebi normalizasyonu (EU iade güvenli varsayılanı) ─────────────────

const SAFE_CANCEL_REASON = "BUYER_ASKED_CANCEL";

/** eBay'in kabul ettiği cancelReason enum değerleri */
const KNOWN_CANCEL_REASONS = [
  "OUT_OF_STOCK",
  "BUYER_ASKED_CANCEL",
  "ADDRESS_ISSUES",
  "ORDER_MISTAKE",
];

/**
 * Bilinmeyen / EU'ya özgü iade sebeplerini eBay'in kabul ettiği güvenli
 * varsayılana düşürür. Bilinen bir enum ise olduğu gibi geçirir.
 */
function normalizeCancelReason(reason: string): string {
  return KNOWN_CANCEL_REASONS.includes(reason) ? reason : SAFE_CANCEL_REASON;
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────────

/** Bir EbayAccount için geçerli token ile EbayClient üretir. Token log'lanmaz. */
async function buildClient(ebayAccountId: string): Promise<EbayClient> {
  const token = await getValidToken(ebayAccountId);
  // 401 alınırsa client onRefresh ile tazelenmiş token'ı yeniden çeksin.
  return new EbayClient(token, undefined, () => getValidToken(ebayAccountId));
}

/** Ham eBay order'ını sadeleştirilmiş EbayOrder şekline çevirir. */
function mapOrder(raw: EbayRawOrder): EbayOrder | null {
  if (!raw.orderId) {
    return null;
  }

  const lineItems = (raw.lineItems ?? [])
    .filter((li): li is EbayLineItem & { lineItemId: string } =>
      typeof li.lineItemId === "string"
    )
    .map((li) => ({
      lineItemId: li.lineItemId,
      sku: li.sku ?? undefined,
      listingId: li.legacyItemId ?? undefined,
    }));

  // Alıcı kargo adresi (varsa) — managed fulfillment için
  const rawShip = raw.fulfillmentStartInstructions?.[0]?.shippingStep?.shipTo;
  const addr = rawShip?.contactAddress;
  const shipTo: EbayShipTo | undefined = rawShip
    ? {
        name: rawShip.fullName ?? undefined,
        line1: addr?.addressLine1 ?? undefined,
        line2: addr?.addressLine2 ?? undefined,
        city: addr?.city ?? undefined,
        state: addr?.stateOrProvince ?? undefined,
        zip: addr?.postalCode ?? undefined,
        country: addr?.countryCode ?? undefined,
        phone: rawShip.primaryPhone?.phoneNumber ?? undefined,
      }
    : undefined;

  return {
    orderId: raw.orderId,
    lineItems,
    totalAmount: raw.totalFeeBasisAmount?.value ?? undefined,
    buyerUsername: raw.buyer?.username ?? undefined,
    shipTo,
  };
}

// ─── 1. Yeni siparişleri çek ───────────────────────────────────────────────────

/**
 * NOT_STARTED (henüz işlenmemiş) siparişleri çeker.
 * createdAfter verilirse sadece o tarihten sonra oluşturulanları getirir.
 */
export async function getNewOrders(
  ebayAccountId: string,
  createdAfter?: Date
): Promise<EbayOrder[]> {
  const client = await buildClient(ebayAccountId);

  // eBay filter sözdizimi: noktalı virgülle ayrılmış filtre çiftleri.
  let filter = "orderfulfillmentstatus:{NOT_STARTED}";
  if (createdAfter) {
    // creationdate:[2024-01-01T00:00:00.000Z..] — açık üst sınırlı aralık
    filter += `,creationdate:[${createdAfter.toISOString()}..]`;
  }

  const response = await client.get<GetOrdersResponse>(
    "/sell/fulfillment/v1/order",
    { filter, limit: "200" }
  );

  const orders: EbayOrder[] = [];
  for (const raw of response.orders ?? []) {
    const mapped = mapOrder(raw);
    if (mapped) {
      orders.push(mapped);
    }
  }

  return orders;
}

// ─── 2. Siparişi iptal et ──────────────────────────────────────────────────────

/**
 * Siparişi iptal eder. reason eBay enum'ında değilse güvenli varsayılana düşer.
 * Başarı → void. Hata fırlatılır (çağıran job retry yapar).
 */
export async function cancelOrder(
  ebayAccountId: string,
  orderId: string,
  reason: string
): Promise<void> {
  const client = await buildClient(ebayAccountId);
  const cancelReason = normalizeCancelReason(reason);

  await client.post<void>(
    `/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/cancel`,
    { cancelReason }
  );
}

// ─── 3. Kargo fulfillment oluştur ──────────────────────────────────────────────

/**
 * Sipariş için kargo/tracking ekler. Response'tan fulfillmentId döner.
 * fulfillmentId dönmezse hata fırlatılır (sessiz başarı yok).
 */
export async function createShippingFulfillment(
  ebayAccountId: string,
  orderId: string,
  trackingNumber: string,
  carrier: string,
  lineItemId: string
): Promise<string> {
  const client = await buildClient(ebayAccountId);

  const response = await client.post<ShippingFulfillmentResponse>(
    `/sell/fulfillment/v1/order/${encodeURIComponent(orderId)}/shipping_fulfillment`,
    {
      lineItems: [{ lineItemId }],
      shippingCarrierCode: carrier,
      trackingNumber,
    }
  );

  if (!response.fulfillmentId) {
    throw new Error(
      `eBay shipping fulfillment oluşturuldu ama fulfillmentId dönmedi: order=${orderId}`
    );
  }

  return response.fulfillmentId;
}
