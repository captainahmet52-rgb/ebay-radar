// Fiyat hesaplama motoru — CLAUDE.md Bölüm 3 & 4
import type { RepricerResult, StockStatus } from "@/types";
import type { Product } from "@prisma/client";
import { convertCurrency, MARKET_CURRENCY } from "@/lib/exchange-rate";
import type { ExtraCosts } from "@/lib/cross-market";
import {
  EBAY_MARKETPLACES,
  resolveEbayMarketplace,
  type EbayMarketplace,
} from "@/lib/ebay-markets";

/**
 * eBay satış fiyatı hesaplama — PAZAR BAŞINA (KDV + düzenleme ücreti + yerel sipariş ücreti).
 * Formül: eBay_fiyatı = (amazon_fiyatı + sabit_ücret) / (1 - etkinÜcret - margin)
 *   etkinÜcret = (FVF + düzenlemeÜcreti) × (1 + ücretKDV) + ekOran
 *   sabitÜcret = sipariş başına ücret (yerel para) × (1 + ücretKDV)
 *   ekOran     = uluslararası işlem ücreti + kur çevrim ücreti + çapraz tampon
 *                (cross-market.ts → resolveExtraCosts; satış toplamına oranlıdır)
 * amazonPriceInEbayCurrency: Amazon fiyatı zaten eBay para birimine çevrilmiş olmalı.
 */
export function calculateEbayPrice(
  amazonPriceInEbayCurrency: number,
  commission: number = 0.136,
  margin: number = 0.20,
  marketplace: EbayMarketplace = EBAY_MARKETPLACES.EBAY_US,
  extraRate: number = 0
): RepricerResult {
  const amazonPrice = amazonPriceInEbayCurrency;
  const fvf = commission > 0 ? commission : marketplace.defaultFvfRate;

  // Etkin oran: (FVF + düzenleme ücreti) × (1 + ücret KDV) + ek oran (intl/kur/çapraz)
  const effectiveRate =
    (fvf + marketplace.regulatoryFeeRate) * (1 + marketplace.feeVatRate) + extraRate;

  const divisor = 1 - effectiveRate - margin;
  if (divisor <= 0) {
    throw new Error("Komisyon + margin toplamı 1'e eşit veya büyük olamaz");
  }

  // Sipariş başına sabit ücret kademesi eBay SATIŞ fiyatına göre belirlenir
  // (Amazon maliyetine değil — eBay ücreti satış fiyatına bakar). İki geçiş:
  // düşük kademeyle hesapla; sonuç eşiği geçtiyse yüksek kademeyle düzelt.
  // (Yüksek kademe fiyatı yalnız yukarı iter → eşik üstünde stabil, salınım yok.)
  const fixedFeeFor = (base: number) => base * (1 + marketplace.feeVatRate);
  let fixedFee = fixedFeeFor(marketplace.perOrderFeeLow);
  let ebayPrice = (amazonPrice + fixedFee) / divisor;
  if (ebayPrice >= marketplace.perOrderThreshold) {
    fixedFee = fixedFeeFor(marketplace.perOrderFeeHigh);
    ebayPrice = (amazonPrice + fixedFee) / divisor;
  }
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
 * Kaynak maliyete çapraz sabit tamponu ekler (kaynak para biriminde), eBay
 * pazarının para birimine çevirir, sonra pazar-bazlı formülü ek oranla uygular.
 * extras: cross-market.ts → resolveExtraCosts çıktısı (verilmezse ek maliyet yok).
 */
export async function calculateEbayPriceForMarket(
  amazonPrice: number,
  amazonMarket: string,
  ebaySite: string,
  commission = 0.136,
  margin = 0.20,
  extras?: ExtraCosts
): Promise<RepricerResult> {
  const marketplace = resolveEbayMarketplace(ebaySite);
  const sourceCost = amazonPrice + (extras?.extraSourceFixed ?? 0);
  const convertedPrice = await convertSourceToEbayCurrency(sourceCost, amazonMarket, ebaySite);
  return calculateEbayPrice(convertedPrice, commission, margin, marketplace, extras?.extraRate ?? 0);
}

/** Kaynak (Amazon) para birimindeki tutarı eBay pazarının para birimine çevirir. */
export async function convertSourceToEbayCurrency(
  amount: number,
  amazonMarket: string,
  ebaySite: string
): Promise<number> {
  const marketplace = resolveEbayMarketplace(ebaySite);
  const fromCurrency = MARKET_CURRENCY[amazonMarket] ?? "USD";
  return convertCurrency(amount, fromCurrency, marketplace.currency);
}

/**
 * Gerçekleşen SATIŞIN kâr kırılımı (sipariş-anı raporlama — verify-order).
 * soldPrice: eBay pazar para biriminde satış fiyatı.
 * costInEbayCurrency: kaynak maliyet (çapraz sabit tampon dahil) eBay para birimine ÇEVRİLMİŞ.
 * extraRate: resolveExtraCosts().extraRate (intl + kur + çapraz yüzde).
 */
export function computeSaleProfit(
  soldPrice: number,
  costInEbayCurrency: number,
  commission: number,
  ebaySite: string,
  extraRate: number
): { ebayFee: number; netProfit: number } {
  const marketplace = resolveEbayMarketplace(ebaySite);
  const fvf = commission > 0 ? commission : marketplace.defaultFvfRate;
  const effectiveRate =
    (fvf + marketplace.regulatoryFeeRate) * (1 + marketplace.feeVatRate) + extraRate;
  const fixedBase =
    soldPrice >= marketplace.perOrderThreshold
      ? marketplace.perOrderFeeHigh
      : marketplace.perOrderFeeLow;
  const fixedFee = fixedBase * (1 + marketplace.feeVatRate);
  const ebayFee = soldPrice * effectiveRate + fixedFee;
  const netProfit = soldPrice - costInEbayCurrency - ebayFee;
  return {
    ebayFee: Math.round(ebayFee * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
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

/** Fiyat histerezisi eşiği — bunun altındaki değişimde eBay güncellenmez. */
export const PRICE_HYSTERESIS_PCT = 0.02;

/**
 * Yeni fiyat eskisinden anlamlı ölçüde farklı mı? (eBay API churn'ünü azaltır.)
 * Eski değer yoksa/0 ise her zaman "anlamlı" sayılır.
 */
export function isSignificantChange(
  oldValue: number | null | undefined,
  newValue: number
): boolean {
  if (oldValue == null || oldValue <= 0) return true;
  return Math.abs(newValue - oldValue) / oldValue >= PRICE_HYSTERESIS_PCT;
}

/**
 * Ürün için tam repricer çıktısı.
 * Stok durumu + fiyat spike kontrolü dahil.
 */
// NOT: Cross-market döviz çevrimi GEREKİYORSA calculateEbayPriceForMarket kullanılmalı.
// reprice yalnız fiyatı zaten eBay para biriminde olan (genelde US→US) durum içindir.
export function reprice(
  product: Product,
  ebaySite: string = "EBAY_US"
): RepricerResult & {
  qty: number;
  shouldPause: boolean;
} {
  if (!product.amazonPrice) {
    throw new Error(`Ürün ${product.asin} için Amazon fiyatı mevcut değil`);
  }

  const result = calculateEbayPrice(
    product.amazonPrice,
    product.ebayFeeRate,
    product.targetMargin,
    resolveEbayMarketplace(ebaySite)
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
