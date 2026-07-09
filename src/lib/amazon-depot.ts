/**
 * AmazonBot depo repository — Radar projesinden (urun-radari) POST edilen KAZANAN
 * ürünleri kalıcı AmazonDepotProduct'a yazar.
 *
 * MİMARİ: Keşif + skorlama (AliExpress'ten ürün bulma) artık RADAR projesinde
 * (eBay radarındaki gibi). Bu proje SADECE alım + yükleme + işletme yapar; burası
 * eBay tarafındaki src/app/api/depot/intake'in Amazon ikizidir — sadece kalıcılaştırma.
 */

import { prisma } from "@/lib/prisma";
import { runBatched, DB_CONCURRENCY } from "@/lib/batch";

/** Radar'ın gönderdiği kazanan ürün (skorlanmış, marka-güvenli). */
export interface AmazonDepotIntakeItem {
  aliId: string;
  title: string;
  category?: string | null;
  brand?: string | null;
  aliCostUsd: number;
  aliShippingUsd: number;
  aliOrders: number;
  aliRating: number;
  // Amazon tarafı sinyalleri (Keepa bağlıysa gelir; yoksa null)
  amazonBsr?: number | null;
  amazonSalesEst?: number | null;
  amazonSellerCount?: number | null;
  amazonSoldByAmazon?: boolean;
  radarScore: number;
}

/**
 * Radar'dan gelen kazananları depoya upsert eder (aliId bazlı). Var olanın sinyalleri
 * + skoru tazelenir; yenisi "active" eklenir. Ölçek: sınırlı eş zamanlı partiler
 * (100K standardı — bağlantı havuzunu boğmaz).
 */
export async function upsertAmazonDepotProducts(
  items: AmazonDepotIntakeItem[]
): Promise<{ saved: number }> {
  await runBatched(items, DB_CONCURRENCY, async (it) => {
    const data = {
      title: it.title,
      category: it.category ?? null,
      brand: it.brand ?? null,
      brandSafe: true, // Radar yalnız marka-güvenli/filtreyi geçen ürünleri yollar
      aliCostUsd: it.aliCostUsd,
      aliShippingUsd: it.aliShippingUsd,
      aliOrders: it.aliOrders,
      aliRating: it.aliRating,
      amazonBsr: it.amazonBsr ?? null,
      amazonSalesEst: it.amazonSalesEst ?? null,
      amazonSellerCount: it.amazonSellerCount ?? null,
      amazonSoldByAmazon: it.amazonSoldByAmazon ?? false,
      radarScore: it.radarScore,
      lastScrapedAt: new Date(),
    };
    await prisma.amazonDepotProduct.upsert({
      where: { aliId: it.aliId },
      create: { aliId: it.aliId, status: "active", ...data },
      update: data, // status'a dokunma — duraklatılmışsa kullanıcı/worker yönetir
    });
  });
  return { saved: items.length };
}
