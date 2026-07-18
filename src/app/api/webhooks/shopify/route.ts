import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyShopifyWebhookHmac } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/shopify — TÜM Shopify webhook'ları tek uçta toplanır.
 *
 * App Store ZORUNLU GDPR webhook'ları (Partner Dashboard'dan bu adrese kaydedilir):
 *   customers/data_request → müşteri verisi talebi. Müşteri PII'ı SAKLAMIYORUZ
 *     (ShopifyOrder'da adres/isim/e-posta yok) — loglanır, dönecek veri yoktur.
 *   customers/redact → müşteri verisi silme. Saklanan müşteri verisi olmadığı
 *     için silinecek bir şey yok; 200 ile onaylanır.
 *   shop/redact → mağaza kaldırıldıktan 48 saat sonra gelir; mağazanın TÜM
 *     kaydı silinir (ShopifyAccount cascade → listing + sipariş).
 *
 * OAuth sonrası API ile kaydedilenler (lib/shopify/webhooks.ts):
 *   app/uninstalled → hesap pasife alınır, token temizlenir.
 *   app_subscriptions/update → Shopify Billing abonelik durumu (paidUntil uzatma).
 *
 * Shopify kuralı: HMAC geçersizse 401 dönmek ZORUNLU (App Store denetimi bunu test eder).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: "invalid hmac" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const shopDomain = (req.headers.get("x-shopify-shop-domain") ?? "").toLowerCase();

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    // Bazı topic'lerde gövdeyi kullanmıyoruz — HMAC zaten doğrulandı, devam
  }

  try {
    switch (topic) {
      case "customers/data_request": {
        // Sakladığımız müşteri verisi yok — denetim izi için loglanır.
        console.log(`[webhooks/shopify] customers/data_request: ${shopDomain} (saklanan müşteri verisi yok)`);
        break;
      }

      case "customers/redact": {
        console.log(`[webhooks/shopify] customers/redact: ${shopDomain} (saklanan müşteri verisi yok)`);
        break;
      }

      case "shop/redact": {
        // Mağaza kaldırılalı 48 saat oldu — tüm izini sil (cascade: listing + sipariş)
        const deleted = await prisma.shopifyAccount.deleteMany({ where: { shopDomain } });
        console.log(`[webhooks/shopify] shop/redact: ${shopDomain} → ${deleted.count} hesap silindi`);
        break;
      }

      case "app/uninstalled": {
        await prisma.shopifyAccount.updateMany({
          where: { shopDomain },
          data: { isActive: false, uninstalledAt: new Date(), accessTokenEncrypted: null },
        });
        console.log(`[webhooks/shopify] app/uninstalled: ${shopDomain} → hesap donduruldu`);
        break;
      }

      case "app_subscriptions/update": {
        const sub = payload.app_subscription as { status?: string } | undefined;
        if (sub?.status === "ACTIVE") {
          // Abonelik yenilendi/aktifleşti: 30 gün + 3 gün ödeme toleransı
          const paidUntil = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000);
          await prisma.shopifyAccount.updateMany({
            where: { shopDomain },
            data: { isActive: true, paidUntil },
          });
          console.log(`[webhooks/shopify] abonelik aktif: ${shopDomain} → paidUntil ${paidUntil.toISOString()}`);
        } else if (sub?.status === "CANCELLED" || sub?.status === "EXPIRED") {
          // paidUntil'e dokunma — kalan süre kullanılır, freeze worker'ı süresi
          // dolunca hesabı kapatır (kullanıcı ödediği dönemi kaybetmez).
          console.log(`[webhooks/shopify] abonelik bitti: ${shopDomain} (${sub.status})`);
        }
        break;
      }

      default:
        // Bilinmeyen topic — 200 ile onayla (Shopify tekrar tekrar denemesin)
        console.log(`[webhooks/shopify] işlenmeyen topic: ${topic} (${shopDomain})`);
    }
  } catch (err) {
    // İşleme hatası → 500: Shopify webhook'u yeniden dener (48 saat boyunca)
    console.error(`[webhooks/shopify] ${topic} işleme hatası:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
