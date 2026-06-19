/**
 * AmazonBot listeleme — depo ürününü bir satıcı hesabında listeler.
 * Yükleme öncesi ZORUNLU marka/kısıt kontrolü (getListingsRestrictions) yapılır.
 */

import { decryptToken } from "@/lib/crypto";
import {
  getSpapiAccessToken,
  getListingsRestrictions,
  putListingsItem,
  searchProductType,
  isSpapiConfigured,
} from "@/lib/amazon-spapi";
import type { AmazonAccount, AmazonDepotProduct } from "@prisma/client";

export interface AmazonListingResult {
  sku: string;
  status: string;
  asin?: string | null;
}

/** Depo ürünü için SKU üretir (aliId bazlı, pazara özgü). */
function buildSku(product: AmazonDepotProduct, market: string): string {
  return `ALI-${market}-${product.aliId}`.slice(0, 40);
}

/**
 * Bir depo ürününü hesabın pazarında listeler/günceller.
 * @param account Amazon satıcı hesabı (refresh token şifreli)
 * @param product Depo ürünü (AliExpress kaynağı)
 * @param price   Hesaplanmış satış fiyatı (pazarın para biriminde)
 * @param qty     Liste adedi
 * @param asin    Eşleşen mevcut ASIN (varsa — marka kısıtı kontrolü için)
 */
export async function createOrUpdateAmazonListing(
  account: AmazonAccount,
  product: AmazonDepotProduct,
  price: number,
  qty: number,
  asin?: string | null
): Promise<AmazonListingResult> {
  if (!isSpapiConfigured()) {
    throw new Error("SP-API yapılandırılmadı — yükleme yapılamaz (API en sonda bağlanacak)");
  }
  if (!account.spapiRefreshTokenEncrypted) {
    throw new Error("Hesabın SP-API refresh token'ı yok");
  }

  const market = account.market;
  const refreshToken = decryptToken(account.spapiRefreshTokenEncrypted);
  const { accessToken } = await getSpapiAccessToken(refreshToken);

  // ZORUNLU: mevcut bir ASIN'e listeleniyorsa marka/kısıt kontrolü
  if (asin) {
    const { allowed, reasons } = await getListingsRestrictions(
      market,
      accessToken,
      account.sellerId,
      asin
    );
    if (!allowed) {
      throw new Error(`Marka/kısıt engeli — listelenemez: ${reasons.join("; ")}`);
    }
  }

  const sku = buildSku(product, market);

  // Ürün tipini başlıktan tespit et (putListingsItem için gerekli)
  const productType = await searchProductType(market, accessToken, product.title ?? "");

  // Marketplace para birimi (currency kodu pazara göre)
  const currency =
    market === "uk" ? "GBP" : market === "ae" ? "AED" : market === "sa" ? "SAR" : "USD";

  // NOT: tam attribute şeması productType'a göre genişletilir (getDefinitionsProductType ile).
  // Minimum zorunlular: durum + stok + fiyat + başlık.
  const attributes: Record<string, unknown> = {
    condition_type: [{ value: "new_new" }],
    item_name: product.title ? [{ value: product.title }] : undefined,
    fulfillment_availability: [{ fulfillment_channel_code: "DEFAULT", quantity: qty }],
    purchasable_offer: [
      { currency, our_price: [{ schedule: [{ value_with_tax: price }] }] },
    ],
  };

  const result = await putListingsItem(market, accessToken, {
    sellerId: account.sellerId,
    sku,
    productType,
    attributes,
  });

  return { sku: result.sku, status: result.status, asin: asin ?? null };
}
