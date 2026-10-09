import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isOnTrial, trialDaysLeft } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { trialEndsAt: true, plan: true, lemonSqueezySubscriptionId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ödeme sağlayıcısı yok (2026-07-17) → lemonSqueezySubscriptionId artık hiç
  // yazılmıyor. Ücretli erişim admin aktivasyonuyla mağazaya paidUntil olarak
  // işlenir; onu da saymazsak paket alan müşteri "Deneme süreniz doldu" görür.
  const paidStore = await prisma.ebayAccount.findFirst({
    where: { userId: session.user.id, paidUntil: { gt: new Date() } },
    select: { id: true },
  });

  const onTrial = isOnTrial(user.trialEndsAt);
  const daysLeft = trialDaysLeft(user.trialEndsAt);
  const hasSubscription = !!user.lemonSqueezySubscriptionId || !!paidStore;
  const trialStarted = !!user.trialEndsAt;
  const trialExpired = trialStarted && !onTrial;

  return NextResponse.json({
    trialEndsAt: user.trialEndsAt,
    onTrial,
    daysLeft,
    hasSubscription,
    trialStarted,
    trialExpired,
    plan: user.plan,
  });
}
