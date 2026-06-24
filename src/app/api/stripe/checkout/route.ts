import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_PRICE_MAP: Record<string, string | undefined> = {
  pro: process.env.STRIPE_PRICE_PRO_ID,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE_ID,
};

export const POST = requireAuth(async (req, { userId }) => {
  try {
    const body = await req.json() as { plan?: string };
    const { plan } = body;

    if (!plan || !["pro", "enterprise"].includes(plan)) {
      return NextResponse.json(
        { error: "Geçerli plan: 'pro' veya 'enterprise'" },
        { status: 400 }
      );
    }

    const priceId = PLAN_PRICE_MAP[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `${plan} planı için fiyat ID'si tanımlı değil` },
        { status: 500 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, stripeCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        plan,
      },
      success_url: `${appUrl}/dashboard/settings?checkout=success`,
      cancel_url: `${appUrl}/dashboard/settings?checkout=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout POST]", err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
});
