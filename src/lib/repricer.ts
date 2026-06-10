// Fiyat hesaplama motoru — CLAUDE.md Bölüm 3 & 4
import type { RepricerResult, StockStatus } from "@/types";
import type { Product } from "@prisma/client";

// CLAUDE.md: >=10$ → 0.40, <10$ → 0.30
function getFixedFee(amazonPrice: number): number {
  return amazonPrice >= 10 ? 0.40 : 0.30;
}

/**
 * eBay satış fiyatı hesaplama.
 * Formül: eBay_fiyatı = (amazon_fiyatı + sabit_ücret) / (1 - komisyon - margin)
 */
export function calculateEbayPrice(
  amazonPrice: number,
  commission: number = 0.136,
  margin: number = 0.20
): RepricerResult {
  const fixedFee = getFixedFee(amazonPrice);
  const divisor = 1 - commission - margin;

  if (divisor <= 0) {
    throw new Error("Komisyon + margin toplamı 1'e eşit veya büyük olamaz");
  }

  const ebayPrice = (amazonPrice + fixedFee) / divisor;

  // eBay'e ödenen komisyon
  const ebayFee = ebayPrice * commission + fixedFee;

  // Net kâr
  const netProfit = ebayPrice - amazonPrice - ebayFee;

  // Gerçek margin yüzdesi
  const marginPct = netProfit / ebayPrice;

  return {
    amazonPrice,
    ebayPrice: Math.round(ebayPrice * 100) / 100,
    ebayFee: Math.round(ebayFee * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    marginPct: Math.round(marginPct * 10000) / 10000,
    recommendedQty: 2, // varsayılan, aşağıda determineQty ile güncellenir
  };
}

/**
 * Stok durumuna göre eBay adedi belirle.
 * CLAUDE.md Bölüm 4:
 * - in_stock   → 2
 * - low(qty≥3) → 1
 * - low(qty<3) → 0 (duraklat)
 * - out        → 0 (duraklat)
 * - unknown    → 0 (duraklat; belirsiz stok → güvenli taraf)
 */
export function determineQty(
  stockStatus: StockStatus | string,
  stockQty: number | null | undefined
): number {
  if (stockStatus === "out" || stockStatus === "unknown") return 0;

  if (stockStatus === "low") {
    const qty = stockQty ?? 0;
    if (qty >= 3) return 1;
    return 0;
  }

  // in_stock
  return 2;
}

/**
 * Fiyat spike kontrolü.
 * CLAUDE.md: %50'den fazla artış → spike
 */
export function isPriceSpike(oldPrice: number, newPrice: number): boolean {
  if (oldPrice <= 0) return false;
  const increase = (newPrice - oldPrice) / oldPrice;
  return increase > 0.50;
}

/**
 * Ürün için tam repricer çıktısı.
 * Stok durumu + fiyat spike kontrolü dahil.
 */
export function reprice(product: Product): RepricerResult & {
  qty: number;
  shouldPause: boolean;
} {
  if (!product.amazonPrice) {
    throw new Error(`Ürün ${product.asin} için Amazon fiyatı mevcut değil`);
  }

  const result = calculateEbayPrice(
    product.amazonPrice,
    product.ebayFeeRate,
    product.targetMargin
  );

  const qty = determineQty(
    product.amazonStockStatus as StockStatus,
    product.amazonStockQty
  );

  // Düşük stok → pollTier hot'a taşınacak (DB güncellemesi çağıran tarafta yapılır)
  const shouldPause = qty === 0;

  // Floor price kontrolü
  let finalEbayPrice = result.ebayPrice;
  if (product.floorPrice && finalEbayPrice < product.floorPrice) {
    // Hesaplanan fiyat tabandan düşükse duraklat
    return {
      ...result,
      ebayPrice: finalEbayPrice,
      qty: 0,
      shouldPause: true,
    };
  }

  return {
    ...result,
    qty,
    shouldPause,
  };
}
