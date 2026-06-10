import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const settingsSchema = z.object({
  autoUploadEnabled:     z.boolean(),
  uploadSchedule:        z.enum(["every_2h","every_4h","every_6h","every_12h","daily","weekly","manual"]),
  uploadScheduleHour:    z.number().int().min(0).max(23),
  uploadDailyLimit:      z.number().int().min(1).max(500),
  uploadMinProfit:       z.number().min(0),
  uploadMinMarginPct:    z.number().min(0).max(100),
  uploadMinAmazonPrice:  z.number().min(0),
  uploadMaxAmazonPrice:  z.number().min(0),
  uploadPrimeOnly:       z.boolean(),
  uploadSoldWithinDays:  z.number().int().nullable(),
  uploadSourceMarket:    z.enum(["US","UK"]),
  uploadEbaySite:        z.enum(["EBAY_US","EBAY_GB"]),
  uploadProfitMarginPct: z.number().min(0).max(100),
  uploadQuantity:        z.number().int().min(1),
  uploadAutoPublish:     z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      autoUploadEnabled:     true,
      uploadSchedule:        true,
      uploadScheduleHour:    true,
      uploadDailyLimit:      true,
      uploadMinProfit:       true,
      uploadMinMarginPct:    true,
      uploadMinAmazonPrice:  true,
      uploadMaxAmazonPrice:  true,
      uploadPrimeOnly:       true,
      uploadSoldWithinDays:  true,
      uploadSourceMarket:    true,
      uploadEbaySite:        true,
      uploadProfitMarginPct: true,
      uploadQuantity:        true,
      uploadAutoPublish:     true,
    },
  });

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri", details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: {
      autoUploadEnabled:     true,
      uploadSchedule:        true,
      uploadScheduleHour:    true,
      uploadDailyLimit:      true,
      uploadMinProfit:       true,
      uploadMinMarginPct:    true,
      uploadMinAmazonPrice:  true,
      uploadMaxAmazonPrice:  true,
      uploadPrimeOnly:       true,
      uploadSoldWithinDays:  true,
      uploadSourceMarket:    true,
      uploadEbaySite:        true,
      uploadProfitMarginPct: true,
      uploadQuantity:        true,
      uploadAutoPublish:     true,
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}
