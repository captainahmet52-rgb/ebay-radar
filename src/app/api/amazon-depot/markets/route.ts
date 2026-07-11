// GET /api/amazon-depot/markets — Radar'ın (urun-radari) sorduğu uç: şu an
// SİSTEME BAĞLI Amazon hesaplarının hangi pazarlarda olduğunu döner. Radar
// bunu okuyup .env'deki sabit AMAZON_RADAR_MARKETS yerine GERÇEK bağlı
// hesaplara göre tarama yapar — yeni hesap eklenince elle ayar değiştirmeye
// gerek kalmaz (eBay'in her mağazanın kendi sourceMarket'ine bakması gibi).
// Kimlik: Authorization: Bearer ${CRON_SECRET} — intake ucuyla aynı secret.
import { NextResponse } from "next/server";
import { requireCron } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireCron(async () => {
  const rows = await prisma.amazonAccount.findMany({
    distinct: ["market"],
    select: { market: true },
  });
  const markets = rows.map((r) => r.market);
  return NextResponse.json({ markets });
});
