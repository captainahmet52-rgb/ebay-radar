/**
 * AliExpress veri kaynağı (iskelet).
 * Kaynak: AliExpress Open Platform Dropshipper API (onay bekliyor — "API en sonda").
 * Bağlanınca fetchAliExpressProduct gerçek veriyi döner; şu an net hata verir.
 */

import type { AliStockStatus } from "@/lib/amazon-repricer";

export interface AliProductData {
  costUsd: number;
  shippingUsd: number;
  stockStatus: AliStockStatus;
  stockQty: number | null;
  title?: string;
}

export function isAliExpressConfigured(): boolean {
  return Boolean(process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_ACCESS_TOKEN);
}

/**
 * Bir AliExpress ürününün güncel fiyat + stoğunu çeker.
 * @throws kaynak bağlanmadıysa (env yoksa).
 */
export async function fetchAliExpressProduct(aliId: string): Promise<AliProductData> {
  if (!isAliExpressConfigured()) {
    throw new Error(
      `AliExpress kaynağı bağlanmadı (aliId ${aliId}) — ` +
      "ALIEXPRESS_APP_KEY / ALIEXPRESS_ACCESS_TOKEN .env'de yok. API en sonda bağlanacak."
    );
  }
  // TODO: ae_sdk ile aliexpress.ds.product.get çağrısı + parse (Only N left sinyali dahil)
  throw new Error("AliExpress entegrasyonu henüz tamamlanmadı (resmi API onayı bekleniyor).");
}
