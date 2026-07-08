// POST /api/webhooks/lemonsqueezy — Lemon Squeezy ödeme/abonelik olayları.
//
// Kimlik: X-Signature header (HMAC-SHA256, LEMONSQUEEZY_WEBHOOK_SECRET ile).
// requireAuth YOK — LS sunucusu çağırır; güvenlik imzayla sağlanır.
//
// Akış (PAKET = MAĞAZA): checkout'a gömülen custom_data.ebay_account_id ile
// hangi mağazanın etkilendiğini biliriz. Ödeme başarılı → mağaza aktive/uzatılır;
// iptal → dönem sonuna kadar açık; süre dolunca → dondurulur (freeze-stores
// eBay ilanlarını güvene alır).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlan } from "@/lib/plans";
import { verifyWebhookSignature } from "@/lib/lemonsqueezy";
import { addDays, STORE_SUBSCRIPTION_DAYS } from "@/lib/store-access";
import { enqueueVerificationForAccount } from "@/lib/ebay/listing-import";

interface LsWebhook {
  meta?: {
    event_name?: string;
    custom_data?: { ebay_account_id?: string; user_id?: string; plan?: string };
  };
  data?: { id?: string; attributes?: Record<string, unknown> };
}

/** ISO tarihi güvenle çözer; geçersizse fallback döner. */
function parseDate(value: unknown, fallback: Date): Date {
  if (typeof value !== "string") return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

async function activateStore(args: {
  ebayAccountId: string;
  userId: string;
  plan: string;
  subscriptionId: string | undefined;
  paidUntil: Date;
}): Promise<void> {
  const planDef = getPlan(args.plan);
  if (!planDef) {
    console.warn(`[ls-webhook] bilinmeyen paket: ${args.plan}`);
    return;
  }
  // Sahiplik doğrulaması: mağaza gerçekten bu kullanıcınınsa işle.
  const account = await prisma.ebayAccount.findFirst({
    where: { id: args.ebayAccountId, userId: args.userId },
    select: { id: true, activatedAt: true },
  });
  if (!account) {
    console.warn(`[ls-webhook] mağaza bulunamadı: ${args.ebayAccountId}`);
    return;
  }

  await prisma.ebayAccount.update({
    where: { id: account.id },
    data: {
      isActive: true,
      activatedAt: account.activatedAt ?? new Date(),
      paidUntil: args.paidUntil,
      plan: args.plan,
      productLimit: planDef.productLimit,
    },
  });
  await prisma.user.update({
    where: { id: args.userId },
    data: { stripeSubscriptionId: args.subscriptionId ?? undefined, plan: args.plan },
  });

  // Frozen'ken atlanmış ilan doğrulamasını tetikle (activate route ile aynı davranış).
  try {
    await enqueueVerificationForAccount(account.id);
  } catch (err) {
    console.error("[ls-webhook] verify tetikleme atlandı:", err);
  }
}

/** Mağazanın paidUntil'ini günceller (iptal → dönem sonu). */
async function setPaidUntil(ebayAccountId: string, userId: string, paidUntil: Date): Promise<void> {
  await prisma.ebayAccount.updateMany({
    where: { id: ebayAccountId, userId },
    data: { paidUntil },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // İmza doğrulaması HAM gövde üzerinden yapılmalı — önce text oku.
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Geçersiz imza" }, { status: 401 });
  }

  let payload: LsWebhook;
  try {
    payload = JSON.parse(rawBody) as LsWebhook;
  } catch {
    return NextResponse.json({ error: "Geçersiz gövde" }, { status: 400 });
  }

  const event = payload.meta?.event_name ?? "";
  const custom = payload.meta?.custom_data;
  const attrs = payload.data?.attributes ?? {};
  const subscriptionId = payload.data?.id;

  const ebayAccountId = custom?.ebay_account_id;
  const userId = custom?.user_id;
  const plan = custom?.plan;
  // Bizim checkout'umuzdan gelmeyen (custom'sız) olayları sessizce geç — 200 dön ki
  // LS tekrar tekrar denemesin.
  if (!ebayAccountId || !userId || !plan) {
    return NextResponse.json({ ok: true, ignored: "custom_data yok" });
  }

  try {
    switch (event) {
      case "subscription_created":
      case "subscription_payment_success":
      case "subscription_resumed":
      case "subscription_unpaused":
        await activateStore({
          ebayAccountId,
          userId,
          plan,
          subscriptionId,
          paidUntil: parseDate(attrs.renews_at, addDays(new Date(), STORE_SUBSCRIPTION_DAYS)),
        });
        break;

      case "subscription_updated": {
        const status = String(attrs.status ?? "");
        if (status === "active" || status === "on_trial") {
          await activateStore({
            ebayAccountId,
            userId,
            plan,
            subscriptionId,
            paidUntil: parseDate(attrs.renews_at, addDays(new Date(), STORE_SUBSCRIPTION_DAYS)),
          });
        } else if (status === "cancelled") {
          // İptal edildi ama dönem sonuna kadar açık kalır.
          await setPaidUntil(ebayAccountId, userId, parseDate(attrs.ends_at, new Date()));
        } else if (status === "expired" || status === "unpaid") {
          await setPaidUntil(ebayAccountId, userId, new Date(Date.now() - 1000));
        }
        break;
      }

      case "subscription_cancelled":
        // Dönem sonuna kadar açık; ends_at gelince freeze-stores dondurur.
        await setPaidUntil(ebayAccountId, userId, parseDate(attrs.ends_at, new Date()));
        break;

      case "subscription_expired":
        // Süre doldu → paidUntil'i geçmişe çek; freeze-stores eBay ilanlarını güvene alır.
        await setPaidUntil(ebayAccountId, userId, new Date(Date.now() - 1000));
        break;

      default:
        // order_created / diğer olaylar → abonelik olayları yönettiği için yok sayılır.
        break;
    }
  } catch (err) {
    console.error(`[ls-webhook] '${event}' işlenemedi:`, err);
    return NextResponse.json({ error: "İşlenemedi" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
