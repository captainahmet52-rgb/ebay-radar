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

const CHANNELS = ["amazon", "shopify"] as const;

export const GET = requireCron(async () => {
  // Kanal başına ayrı sayım: Amazon deposu dolunca Shopify keşfi durmasın diye
  // Radar kapasiteyi kanal bazında kontrol eder (byChannel). Üst düzey total/available
  // geriye uyumluluk için SADECE Amazon izidir (2026-07-22 ayrımı).
  const counts = await Promise.all(
    CHANNELS.map(async (channel) => {
      const where = { status: "active", sourceChannel: channel };
      // "available" = kanalın kendi listelemesi olmayan ürün (Amazon: listings, Shopify: shopifyListings)
      const unlisted = channel === "amazon" ? { listings: { none: {} } } : { shopifyListings: { none: {} } };
      const [total, available] = await Promise.all([
        prisma.amazonDepotProduct.count({ where }),
        prisma.amazonDepotProduct.count({ where: { ...where, ...unlisted } }),
      ]);
      return [channel, { total, available }] as const;
    })
  );
  const byChannel = Object.fromEntries(counts);
  return NextResponse.json({ ...byChannel.amazon, byChannel });
});
