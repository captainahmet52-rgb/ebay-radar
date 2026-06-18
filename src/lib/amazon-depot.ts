/**
 * AmazonBot depo repository — radar sonuçlarını kalıcı AmazonDepotProduct'a yazar.
 * Sadece radardan GEÇEN (marka/yasak/kâr/talep filtrelerini aşan) ürünler depoya girer.
 * Marka-güvensiz / yasaklı ürünler ASLA depoya yazılmaz.
 */

import { prisma } from "@/lib/prisma";
import type { AmazonCandidate, RadarVerdict } from "@/lib/amazon-radar";

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
