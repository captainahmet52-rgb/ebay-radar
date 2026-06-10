// eBay Account API — politika ve konum yönetimi
//
// eBay Sell Account API v1 endpoint'leri üzerinden fulfillment, payment
// ve return politikalarını çeker; merchant location key'ini alır.
// Sonuçlar DB'ye cache'lenir; mevcut kayıt varsa tekrar API çağrısı yapılmaz.
//
// Güvenlik: token değişkeni ASLA log'a yazılmaz.

import { prisma } from "@/lib/prisma";
import { EbayClient } from "@/lib/ebay/client";
import { getValidToken } from "@/lib/ebay/oauth";

// ─── eBay API yanıt şekilleri ─────────────────────────────────────────────────

interface FulfillmentPolicy {
  fulfillmentPolicyId: string;
  name: string;
}

interface PaymentPolicy {
  paymentPolicyId: string;
  name: string;
}

interface ReturnPolicy {
  returnPolicyId: string;
  name: string;
}

interface MerchantLocation {
  merchantLocationKey: string;
  merchantLocationStatus?: string;
  name?: string;
}

interface FulfillmentPoliciesResponse {
  fulfillmentPolicies?: FulfillmentPolicy[];
}

interface PaymentPoliciesResponse {
  paymentPolicies?: PaymentPolicy[];
}

interface ReturnPoliciesResponse {
  returnPolicies?: ReturnPolicy[];
}

interface MerchantLocationsResponse {
  locations?: MerchantLocation[];
}

// ─── Ana fonksiyonlar ─────────────────────────────────────────────────────────

/**
 * eBay Account API'den fulfillment, payment ve return politikalarını çeker,
 * ilk politikanın ID'sini EbayAccount kaydına yazar.
 *
 * Politikalardan herhangi biri eBay'de tanımlı değilse Error fırlatır.
 * Token ASLA log'a yazılmaz.
 */
export async function fetchAndCacheAccountPolicies(
  ebayAccountId: string
): Promise<void> {
  const token = await getValidToken(ebayAccountId);
  const client = new EbayClient(token);

  const [fulfillmentRes, paymentRes, returnRes] = await Promise.all([
    client.get<FulfillmentPoliciesResponse>(
      "/sell/account/v1/fulfillment_policy",
      { marketplace_id: "EBAY_US" }
    ),
    client.get<PaymentPoliciesResponse>("/sell/account/v1/payment_policy", {
      marketplace_id: "EBAY_US",
    }),
    client.get<ReturnPoliciesResponse>("/sell/account/v1/return_policy", {
      marketplace_id: "EBAY_US",
    }),
  ]);

  const fulfillmentPolicy = fulfillmentRes.fulfillmentPolicies?.[0];
  if (!fulfillmentPolicy) {
    throw new Error("eBay'de fulfillment politikası tanımlı değil");
  }

  const paymentPolicy = paymentRes.paymentPolicies?.[0];
  if (!paymentPolicy) {
    throw new Error("eBay'de payment politikası tanımlı değil");
  }

  const returnPolicy = returnRes.returnPolicies?.[0];
  if (!returnPolicy) {
    throw new Error("eBay'de return politikası tanımlı değil");
  }

  await prisma.ebayAccount.update({
    where: { id: ebayAccountId },
    data: {
      fulfillmentPolicyId: fulfillmentPolicy.fulfillmentPolicyId,
      paymentPolicyId: paymentPolicy.paymentPolicyId,
      returnPolicyId: returnPolicy.returnPolicyId,
      policiesCheckedAt: new Date(),
    },
  });
}

/**
 * eBay Account API'den ilk aktif merchant location key'ini çeker ve
 * EbayAccount kaydına yazar.
 *
 * Aktif location bulunamazsa Error fırlatır.
 * Token ASLA log'a yazılmaz.
 */
export async function getMerchantLocation(
  ebayAccountId: string
): Promise<string> {
  const token = await getValidToken(ebayAccountId);
  const client = new EbayClient(token);

  const res = await client.get<MerchantLocationsResponse>(
    "/sell/account/v1/location",
    { limit: "1" }
  );

  const location = res.locations?.[0];
  if (!location) {
    throw new Error(
      "eBay'de merchant location tanımlı değil. eBay Seller Hub'dan bir depolama konumu ekleyin."
    );
  }

  const { merchantLocationKey } = location;

  await prisma.ebayAccount.update({
    where: { id: ebayAccountId },
    data: { merchantLocationKey },
  });

  return merchantLocationKey;
}

/**
 * EbayAccount için listeleme işleminde gereken tüm politika ID'lerini ve
 * merchant location key'ini döndürür.
 *
 * DB'de dolu kayıt varsa API çağrısı yapılmaz (cache hit).
 * Eksik alan varsa fetchAndCacheAccountPolicies + getMerchantLocation çağrılır.
 */
export async function getPolicyIds(ebayAccountId: string): Promise<{
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  merchantLocationKey: string;
}> {
  const account = await prisma.ebayAccount.findUnique({
    where: { id: ebayAccountId },
    select: {
      fulfillmentPolicyId: true,
      paymentPolicyId: true,
      returnPolicyId: true,
      merchantLocationKey: true,
    },
  });

  if (!account) {
    throw new Error(`EbayAccount bulunamadı: ${ebayAccountId}`);
  }

  const {
    fulfillmentPolicyId,
    paymentPolicyId,
    returnPolicyId,
    merchantLocationKey,
  } = account;

  // Cache hit — tüm alanlar dolu
  if (
    fulfillmentPolicyId &&
    paymentPolicyId &&
    returnPolicyId &&
    merchantLocationKey
  ) {
    return {
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      merchantLocationKey,
    };
  }

  // Cache miss — API'den çek ve DB'ye yaz
  const policiesNeeded =
    !fulfillmentPolicyId || !paymentPolicyId || !returnPolicyId;
  const locationNeeded = !merchantLocationKey;

  const tasks: Promise<unknown>[] = [];
  if (policiesNeeded) tasks.push(fetchAndCacheAccountPolicies(ebayAccountId));
  if (locationNeeded) tasks.push(getMerchantLocation(ebayAccountId));
  await Promise.all(tasks);

  // Güncel kaydı tekrar çek
  const updated = await prisma.ebayAccount.findUnique({
    where: { id: ebayAccountId },
    select: {
      fulfillmentPolicyId: true,
      paymentPolicyId: true,
      returnPolicyId: true,
      merchantLocationKey: true,
    },
  });

  if (
    !updated?.fulfillmentPolicyId ||
    !updated?.paymentPolicyId ||
    !updated?.returnPolicyId ||
    !updated?.merchantLocationKey
  ) {
    throw new Error(
      `EbayAccount politikaları hâlâ eksik: ${ebayAccountId}. eBay hesabınızda politika ve konum tanımladığınızdan emin olun.`
    );
  }

  return {
    fulfillmentPolicyId: updated.fulfillmentPolicyId,
    paymentPolicyId: updated.paymentPolicyId,
    returnPolicyId: updated.returnPolicyId,
    merchantLocationKey: updated.merchantLocationKey,
  };
}

/**
 * EbayAccount'ta gerekli politika alanlarının dolu olup olmadığını kontrol eder.
 * getPolicyIds'i çağırır (gerekirse API'den çeker).
 *
 * Döndürür: { valid: boolean; missing: string[] }
 * valid = true ise tüm alanlar mevcuttur.
 */
export async function checkPoliciesValid(ebayAccountId: string): Promise<{
  valid: boolean;
  missing: string[];
}> {
  try {
    await getPolicyIds(ebayAccountId);
    return { valid: true, missing: [] };
  } catch {
    // getPolicyIds başarısız olduysa hangi alanların eksik olduğunu tespit et
    const account = await prisma.ebayAccount.findUnique({
      where: { id: ebayAccountId },
      select: {
        fulfillmentPolicyId: true,
        paymentPolicyId: true,
        returnPolicyId: true,
        merchantLocationKey: true,
      },
    });

    if (!account) {
      return {
        valid: false,
        missing: [
          "fulfillmentPolicyId",
          "paymentPolicyId",
          "returnPolicyId",
          "merchantLocationKey",
        ],
      };
    }

    const missing: string[] = [];
    if (!account.fulfillmentPolicyId) missing.push("fulfillmentPolicyId");
    if (!account.paymentPolicyId) missing.push("paymentPolicyId");
    if (!account.returnPolicyId) missing.push("returnPolicyId");
    if (!account.merchantLocationKey) missing.push("merchantLocationKey");

    return { valid: missing.length === 0, missing };
  }
}
