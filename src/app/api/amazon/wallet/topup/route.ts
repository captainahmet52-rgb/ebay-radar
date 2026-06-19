import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireAuth } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ amountUsd: z.number().min(5).max(1000) });

/**
 * POST /api/amazon/wallet/topup
 * Stripe Checkout (tek seferlik ödeme) ile kredi yükleme bağlantısı üretir.
 * Ödeme tamamlanınca stripe webhook bakiyeyi ekler.
 */
export const POST = requireAuth(async (req, { userId }) => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Ödeme yapılandırılmadı (STRIPE_SECRET_KEY)" }, { status: 503 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz tutar (5-1000 USD)" }, { status: 400 });
  }
  const { amountUsd } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(amountUsd * 100),
          product_data: { name: `Lean Automation kredi yükleme ($${amountUsd})` },
        },
        quantity: 1,
      },
    ],
    metadata: { userId, type: "credit_topup", amountUsd: String(amountUsd) },
    success_url: `${appUrl}/amazon/orders?topup=success`,
    cancel_url: `${appUrl}/amazon/orders?topup=cancelled`,
  });

  return NextResponse.json({ url: session.url });
});
