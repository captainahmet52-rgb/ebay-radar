// Shopify satış fiyatı hesabı.
//
// Amazon'dan farkı: pazar yeri komisyonu YOK (müşterinin kendi mağazası);
// yalnız ödeme işlem ücreti (~%3) + hedef kâr marjı. Kanal maliyeti düşük
// olduğu için varsayılan marj daha yüksek tutulur (%30).

export const SHOPIFY_DEFAULT_MARGIN = 0.30;
/** Ödeme sağlayıcı işlem ücreti payı (Shopify Payments ~%2.9 + sabit). */
export const SHOPIFY_PAYMENT_FEE_RATE = 0.03;
/** Taban fiyat — çok ucuz ürünlerde bile kargo/iade riskini karşılar. */
export const SHOPIFY_MIN_PRICE_USD = 9.99;

export interface ShopifyPriceResult {
  salePrice: number;
  totalCostUsd: number;
  estimatedProfitUsd: number;
}

/**
 * maliyet + kargo → satış fiyatı.
 * Formül: fiyat = maliyet / (1 - ödemeÜcreti - marj) → marj SATIŞ fiyatı
 * üzerinden korunur (maliyet üzerinden değil). .99 psikolojik yuvarlama.
 */
export function calculateShopifyPrice(
  costUsd: number,
  shippingUsd: number = 0,
  marginRate: number = SHOPIFY_DEFAULT_MARGIN
): ShopifyPriceResult {
  const totalCost = costUsd + shippingUsd;
  const divisor = 1 - SHOPIFY_PAYMENT_FEE_RATE - marginRate;
  const raw = divisor > 0 ? totalCost / divisor : totalCost * 2;

  // .99'a yuvarla, taban fiyatın altına inme
  const rounded = Math.max(SHOPIFY_MIN_PRICE_USD, Math.ceil(raw) - 0.01);
  const profit = rounded * (1 - SHOPIFY_PAYMENT_FEE_RATE) - totalCost;

  return {
    salePrice: Number(rounded.toFixed(2)),
    totalCostUsd: Number(totalCost.toFixed(2)),
    estimatedProfitUsd: Number(profit.toFixed(2)),
  };
}
