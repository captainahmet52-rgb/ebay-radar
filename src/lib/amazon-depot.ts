/**
 * AmazonBot depo repository — radar sonuçlarını kalıcı AmazonDepotProduct'a yazar.
 * Sadece radardan GEÇEN (marka/yasak/kâr/talep filtrelerini aşan) ürünler depoya girer.
 * Marka-güvensiz / yasaklı ürünler ASLA depoya yazılmaz.
 */

import { prisma } from "@/lib/prisma";
import { amazonRadarScanQueue } from "@/lib/queues";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";
import type { AmazonCandidate, RadarVerdict } from "@/lib/amazon-radar";

/** Depodaki taze (aktif + marka-güvenli) ürün bu sayının altına düşerse radar HEMEN çalışır. */
export const AMAZON_DEPOT_MIN_ACTIVE = Number(process.env.AMAZON_DEPOT_MIN_ACTIVE ?? 20);

export interface RadarResult {
  candidate: AmazonCandidate;
  verdict: RadarVerdict;
}

/**
 * Radardan geçen adayları depoya upsert eder (aliId bazlı).
 * Var olan ürünün sinyalleri + skoru tazelenir; yenisi "active" olarak eklenir.
 */
export async function saveRadarWinnersToDepot(
  results: RadarResult[]
): Promise<{ saved: number; skipped: number }> {
  let saved = 0;
  let skipped = 0;

  for (const { candidate, verdict } of results) {
    if (!verdict.pass) {
      skipped++;
      continue;
    }

    const data = {
      title: candidate.title,
      category: candidate.category ?? null,
      brand: candidate.brand ?? null,
      brandSafe: true, // geçtiyse marka/yasak filtresini aşmıştır
      aliCostUsd: candidate.aliCost,
      aliShippingUsd: candidate.aliShipping,
      aliOrders: candidate.aliOrders,
      aliRating: candidate.aliRating,
      amazonBsr: candidate.amazonBsr ?? null,
      amazonSalesEst: candidate.amazonSalesEst ?? null,
      amazonSellerCount: candidate.amazonSellerCount ?? null,
      amazonSoldByAmazon: candidate.amazonSoldByAmazon ?? false,
      radarScore: verdict.score,
      lastScrapedAt: new Date(),
    };

    await prisma.amazonDepotProduct.upsert({
      where: { aliId: candidate.aliId },
      create: { aliId: candidate.aliId, status: "active", ...data },
      update: data, // status'a dokunma — duraklatılmışsa kullanıcı/worker yönetir
    });
    saved++;
  }

  return { saved, skipped };
}

/** Depodaki taze ürün sayısı (radar bekçisi için). */
export async function countActiveDepot(): Promise<number> {
  return prisma.amazonDepotProduct.count({ where: { status: "active", brandSafe: true } });
}

/**
 * Depo eşik altındaysa tüm pazarlar için radarı HEMEN tetikler.
 * 10 dakikalık kova ile dedupe: aynı pencerede tekrar tekrar tetiklenmez.
 * Ürün bittiğinde / yüklendiğinde / bekçi turunda çağrılır.
 */
export async function triggerRadarIfLow(
  reason: string
): Promise<{ triggered: boolean; count: number }> {
  const count = await countActiveDepot();
  if (count >= AMAZON_DEPOT_MIN_ACTIVE) return { triggered: false, count };

  const bucket = Math.floor(Date.now() / (10 * 60 * 1000)); // 10 dk pencere
  await Promise.all(
    Object.keys(AMAZON_MARKETS).map((market) =>
      amazonRadarScanQueue.add(
        "amazon-radar-scan",
        { market },
        { jobId: `amazon-radar:auto:${market}:${bucket}` }
      )
    )
  );
  console.log(`[depot] Eşik altı (${count}/${AMAZON_DEPOT_MIN_ACTIVE}) — radar tetiklendi: ${reason}`);
  return { triggered: true, count };
}
