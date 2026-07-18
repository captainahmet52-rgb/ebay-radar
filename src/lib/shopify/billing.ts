// Shopify Billing — paket parası Shopify üzerinden tahsil edilir.
//
// Neden Shopify Billing: App Store'daki uygulamalar ücretlerini Shopify Billing
// ile almak ZORUNDA; ayrıca reddedilen Lemon Squeezy sonrası bu kanal için ödeme
// sorununu da çözer (ilk $1M'a kadar Shopify komisyonu %0).
//
// Akış: /api/shopify/billing/start → appSubscriptionCreate → confirmationUrl'e
// yönlendir → mağaza sahibi Shopify admin'de onaylar → returnUrl'e döner →
// /api/shopify/billing/callback abonelik durumunu doğrular → paket aktive edilir.
// Yenilemeler app_subscriptions/update webhook'u ile paidUntil'i uzatır.
//
// Açma anahtarı: SHOPIFY_BILLING_ENABLED=true (App Store başvurusuyla birlikte).
// SHOPIFY_BILLING_TEST=true → test abonelikleri (gerçek para çekilmez, dev store).

import { shopifyGraphql } from "./client";

export function isShopifyBillingEnabled(): boolean {
  return process.env.SHOPIFY_BILLING_ENABLED === "true";
}

export interface ShopifyPlan {
  id: string;
  name: string;
  priceUsd: number;
  productLimit: number;
}

// ⚠️ TASLAK FİYATLAR — sahibin onayı olmadan YAYINA AÇILMAZ (SHOPIFY_BILLING_ENABLED
// kapalı kaldığı sürece hiçbir kullanıcı görmez). Onay gelince burada güncellenir.
export const SHOPIFY_PLANS: ShopifyPlan[] = [
  { id: "starter", name: "Starter", priceUsd: 19.99, productLimit: 300 },
  { id: "growth", name: "Growth", priceUsd: 39.99, productLimit: 750 },
  { id: "pro", name: "Pro", priceUsd: 69.99, productLimit: 1500 },
];

export function getShopifyPlan(planId: string): ShopifyPlan | undefined {
  return SHOPIFY_PLANS.find((p) => p.id === planId);
}

interface AppSubscriptionCreateResult {
  appSubscriptionCreate: {
    confirmationUrl: string | null;
    appSubscription: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const APP_SUBSCRIPTION_CREATE = /* GraphQL */ `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $test: Boolean!
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, lineItems: $lineItems) {
      confirmationUrl
      appSubscription {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/** Abonelik oluşturur; mağaza sahibinin onaylayacağı confirmationUrl döner. */
export async function createAppSubscription(
  shopDomain: string,
  accessToken: string,
  plan: ShopifyPlan,
  returnUrl: string
): Promise<string> {
  const res = await shopifyGraphql<AppSubscriptionCreateResult>(
    shopDomain,
    accessToken,
    APP_SUBSCRIPTION_CREATE,
    {
      name: `Lean Automation — ${plan.name}`,
      returnUrl,
      test: process.env.SHOPIFY_BILLING_TEST === "true",
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.priceUsd, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    }
  );

  const { confirmationUrl, userErrors } = res.appSubscriptionCreate;
  if (userErrors.length > 0 || !confirmationUrl) {
    throw new Error(
      `Abonelik oluşturulamadı: ${userErrors.map((e) => e.message).join("; ") || "confirmationUrl boş"}`
    );
  }
  return confirmationUrl;
}

interface AppSubscriptionStatusResult {
  node: { id: string; status: string } | null;
}

const APP_SUBSCRIPTION_STATUS = /* GraphQL */ `
  query AppSubscriptionStatus($id: ID!) {
    node(id: $id) {
      ... on AppSubscription {
        id
        status
      }
    }
  }
`;

/** Onay dönüşünde abonelik durumunu doğrular (charge_id → AppSubscription GID). */
export async function getAppSubscriptionStatus(
  shopDomain: string,
  accessToken: string,
  chargeId: string
): Promise<string | null> {
  // charge_id sayısal gelir; GID formatına çevrilir
  const gid = chargeId.startsWith("gid://")
    ? chargeId
    : `gid://shopify/AppSubscription/${chargeId}`;

  const res = await shopifyGraphql<AppSubscriptionStatusResult>(
    shopDomain,
    accessToken,
    APP_SUBSCRIPTION_STATUS,
    { id: gid }
  );
  return res.node?.status ?? null;
}
