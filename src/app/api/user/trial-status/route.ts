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
    select: { trialEndsAt: true, plan: true, stripeSubscriptionId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const onTrial = isOnTrial(user.trialEndsAt);
  const daysLeft = trialDaysLeft(user.trialEndsAt);
  const hasSubscription = !!user.stripeSubscriptionId;
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
