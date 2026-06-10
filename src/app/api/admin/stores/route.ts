import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireAdmin(async () => {
  const stores = await prisma.trackedStore.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { depotProducts: true } } },
  });
  return NextResponse.json(stores);
});

export const POST = requireAdmin(async (req) => {
  const body = (await req.json()) as { ebayUsername?: string; storeUrl?: string };
  if (!body.ebayUsername || !body.storeUrl) {
    return NextResponse.json(
      { error: "ebayUsername ve storeUrl zorunlu" },
      { status: 400 }
    );
  }
  const store = await prisma.trackedStore.create({
    data: { ebayUsername: body.ebayUsername, storeUrl: body.storeUrl },
  });
  return NextResponse.json(store, { status: 201 });
});
