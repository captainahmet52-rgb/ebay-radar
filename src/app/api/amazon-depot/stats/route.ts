// GET /api/amazon-depot/stats — Radar'ın (urun-radari) sorduğu uç: depoda şu an
// kaç ürün var? Radar bunu okuyup depoyu HEDEF sayıda (varsayılan 500) tutar:
// depo doluysa hiç tarama yapmaz (ScrapingBee kredisi yanmaz), eksik varsa
// sadece eksik kadar yeni ürün gönderir.
// "available" = aktif VE henüz hiçbir mağazaya yüklenmemiş ürün — bir ürün
// mağazaya yüklenince listing kaydı oluşur ve bu sayıdan düşer, radar da
// yerine yenisini bulur (kullanıcının "50 yüklendi → 50 yenisi gelsin" akışı).
// Kimlik: Authorization: Bearer ${CRON_SECRET} — intake/markets uçlarıyla aynı.
import { NextResponse } from "next/server";
import { requireCron } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const GET = requireCron(async () => {
  const [total, available] = await Promise.all([
    prisma.amazonDepotProduct.count({ where: { status: "active" } }),
    prisma.amazonDepotProduct.count({
      where: { status: "active", listings: { none: {} } },
    }),
  ]);
  return NextResponse.json({ total, available });
});
