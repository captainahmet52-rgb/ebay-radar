// Shopify webhook altyapısı:
//   1. Gelen webhook'un HMAC doğrulaması (X-Shopify-Hmac-Sha256, base64)
//   2. OAuth sonrası webhook aboneliği kurma (app/uninstalled, app_subscriptions/update)
//
// NOT — App Store zorunlu GDPR webhook'ları (customers/data_request,
// customers/redact, shop/redact) API ile DEĞİL Partner Dashboard'daki app
// ayarlarından kaydedilir; hepsi /api/webhooks/shopify adresini göstermeli.

import crypto from "crypto";
import { shopifyGraphql } from "./client";

/** Gelen webhook gövdesinin Shopify imzasını doğrular (timing-safe). */
export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_APP_SECRET;
  if (!secret || !hmacHeader) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface WebhookSubscriptionCreateResult {
  webhookSubscriptionCreate: {
    webhookSubscription: { id: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
}

const WEBHOOK_SUBSCRIPTION_CREATE = /* GraphQL */ `
  mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
    ) {
      webhookSubscription {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * OAuth callback sonrası çağrılır — best-effort: webhook kurulamazsa mağaza
 * bağlantısı YİNE başarılıdır (sipariş çekme zaten polling ile yürür; webhook
 * yalnız uninstall/abonelik sinyali için). Zaten kayıtlı topic'te Shopify
 * "address taken" userError döner; bu normaldir ve sessizce geçilir.
 */
export async function registerShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
  appBaseUrl: string
): Promise<void> {
  const callbackUrl = `${appBaseUrl.replace(/\/$/, "")}/api/webhooks/shopify`;
  const topics = ["APP_UNINSTALLED", "APP_SUBSCRIPTIONS_UPDATE"];

  for (const topic of topics) {
    try {
      const res = await shopifyGraphql<WebhookSubscriptionCreateResult>(
        shopDomain,
        accessToken,
        WEBHOOK_SUBSCRIPTION_CREATE,
        { topic, callbackUrl }
      );
      const errs = res.webhookSubscriptionCreate.userErrors;
      // "address for this topic has already been taken" → tekrar bağlanma, sorun değil
      if (errs.length > 0 && !errs.some((e) => /taken/i.test(e.message))) {
        console.error(`[shopify/webhooks] ${topic} kaydı hatası: ${errs.map((e) => e.message).join("; ")}`);
      }
    } catch (err) {
      console.error(
        `[shopify/webhooks] ${topic} kaydı başarısız (${shopDomain}):`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
