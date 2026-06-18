// Fiyat hesaplama motoru — CLAUDE.md Bölüm 3 & 4
import type { RepricerResult, StockStatus } from "@/types";
import type { Product } from "@prisma/client";
import { convertCurrency, MARKET_CURRENCY } from "@/lib/exchange-rate";
import {
  EBAY_MARKETPLACES,
  resolveEbayMarketplace,
  type EbayMarketplace,
} from "@/lib/ebay-markets";

/**
 * eBay satış fiyatı hesaplama — PAZAR BAŞINA (KDV + düzenleme ücreti + yerel sipariş ücreti).
 * Formül: eBay_fiyatı = (amazon_fiyatı + sabit_ücret) / (1 - etkinÜcret - margin)
 *   etkinÜcret = (FVF + düzenlemeÜcreti) × (1 + ücretKDV)
 *   sabitÜcret = sipariş başına ücret (yerel para) × (1 + ücretKDV)
 * amazonPriceInEbayCurrency: Amazon fiyatı zaten eBay para birimine çevrilmiş olmalı.
 */
export function calculateEbayPrice(
  amazonPriceInEbayCurrency: number,
  commission: number = 0.136,
  margin: number = 0.20,
  marketplace: EbayMarketplace = EBAY_MARKETPLACES.EBAY_US
): RepricerResult {
  const amazonPrice = amazonPriceInEbayCurrency;
  const fvf = commission > 0 ? commission : marketplace.defaultFvfRate;

  // Sipariş başına sabit ücret (yerel para) + ücret KDV'si
  const baseFixed =
    amazonPrice >= marketplace.perOrderThreshold
      ? marketplace.perOrderFeeHigh
      : marketplace.perOrderFeeLow;
  const fixedFee = baseFixed * (1 + marketplace.feeVatRate);

  // Etkin oran: (FVF + düzenleme ücreti) × (1 + ücret KDV)
  const effectiveRate = (fvf + marketplace.regulatoryFeeRate) * (1 + marketplace.feeVatRate);

  const divisor = 1 - effectiveRate - margin;
  if (divisor <= 0) {
    throw new Error("Komisyon + margin toplamı 1'e eşit veya büyük olamaz");
  }

  const ebayPrice = (amazonPrice + fixedFee) / divisor;
  const ebayFee = ebayPrice * effectiveRate + fixedFee;
  const netProfit = ebayPrice - amazonPrice - ebayFee;
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
 * Cross-marketplace fiyat hesaplama.
 * Amazon fiyatını eBay pazarının para birimine çevirir, sonra pazar-bazlı formülü uygular.
 */
export async function calculateEbayPriceForMarket(
  amazonPrice: number,
  amazonMarket: string,
  ebaySite: string,
  commission = 0.136,
  margin = 0.20
): Promise<RepricerResult> {
  const marketplace = resolveEbayMarketplace(ebaySite);
  const fromCurrency = MARKET_CURRENCY[amazonMarket] ?? "USD";
  const toCurrency = marketplace.currency;
  const convertedPrice = await convertCurrency(amazonPrice, fromCurrency, toCurrency);
  return calculateEbayPrice(convertedPrice, commission, margin, marketplace);
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
