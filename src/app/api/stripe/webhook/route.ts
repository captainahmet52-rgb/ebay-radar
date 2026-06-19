import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Next.js App Router: raw body için
export const config = { api: { bodyParser: false } };

function planFromPriceId(priceId: string): string {
  if (priceId === process.env.STRIPE_PRICE_PRO_ID) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE_ID) return "enterprise";
  return "free";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return NextResponse.json({ error: "Webhook imzası eksik" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[stripe/webhook] İmza doğrulama hatası:", err);
      return NextResponse.json({ error: "Geçersiz imza" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const customerId = session.customer as string | null;

        if (userId && customerId) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: customerId },
          });
        }

        // Kredi yükleme (tek seferlik ödeme) → cüzdana ekle + ledger
        if (userId && session.metadata?.type === "credit_topup") {
          const amountUsd = Number(session.metadata.amountUsd ?? 0);
          if (amountUsd > 0) {
            await prisma.$transaction([
              prisma.user.update({
                where: { id: userId },
                data: { creditBalanceUsd: { increment: amountUsd } },
              }),
              prisma.creditTransaction.create({
                data: { userId, amountUsd, type: "topup", refId: session.id, note: "Stripe kredi yükleme" },
              }),
            ]);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0]?.price?.id ?? "";
        const plan = planFromPriceId(priceId);
        const stripeSubscriptionId = subscription.id;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan, stripeSubscriptionId },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { plan: "free", stripeSubscriptionId: null },
        });
        break;
      }

      default:
        // Bilinmeyen event'ler sessizce geçilir
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
