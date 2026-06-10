// eBay Inventory + Offer API işlemleri
//
// eBay'de üç ayrı kavram vardır:
//   SKU       — inventory item'ı tanımlar; biz üretiyoruz: "EBAY-{asin}"
//   offerId   — fiyat/koşul kaydı; eBay tarafından atanır
//   listingId — marketplace'teki aktif ilan ID'si; publish sonrası döner
//
// bulk_update_price_quantity → SKU + offerId alır (listingId ALMAZ)
// Fiyat güncellemesi       → offers[].offerId gerektirir
// Stok güncellemesi        → sku + shipToLocationAvailability yeterlidir

import { EbayClient } from "@/lib/ebay/client";
import { decryptToken } from "@/lib/crypto";
import type { EbayAccount, Product } from "@prisma/client";

function getClient(ebayAccount: EbayAccount): EbayClient {
  if (!ebayAccount.oauthTokenEncrypted) {
    throw new Error(`EbayAccount ${ebayAccount.id} için access token mevcut değil`);
  }
  const accessToken = decryptToken(ebayAccount.oauthTokenEncrypted);
  return new EbayClient(accessToken);
}

function buildSku(product: Product): string {
  return `EBAY-${product.asin}`;
}

interface OfferResponse {
  offerId?: string;
  offers?: Array<{ offerId: string; status: string }>;
  listingId?: string;
}

/** createOrUpdateListing dönüş tipi — DB'ye yazılacak üç alan */
export interface ListingIdentifiers {
  listingId: string; // eBay marketplace listing ID
  offerId: string;   // fiyat güncellemeleri için
  sku: string;       // stok güncellemeleri için
}

/**
 * eBay'de inventory item oluştur/güncelle, offer yayınla.
 * Döndürülen {listingId, offerId, sku} DB'ye kaydedilmeli.
 */
export async function createOrUpdateListing(
  ebayAccount: EbayAccount,
  product: Product,
  qty: number,
  price: number
): Promise<ListingIdentifiers> {
  const client = getClient(ebayAccount);
  const sku = buildSku(product);

  // 1. Inventory Item oluştur / güncelle
  await client.put(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    availability: {
      shipToLocationAvailability: { quantity: qty },
    },
    condition: "NEW",
    product: {
      title: product.title ?? `Amazon ASIN: ${product.asin}`,
      imageUrls: product.imageUrl ? [product.imageUrl] : [],
      description: product.title ?? "",
    },
  });

  // 2. Mevcut offer var mı kontrol et
  let offerId: string | null = null;
  try {
    const offersResp = await client.get<OfferResponse>(
      `/sell/inventory/v1/offer`,
      { sku }
    );
    if (offersResp.offers && offersResp.offers.length > 0) {
      offerId = offersResp.offers[0].offerId;
    }
  } catch {
    offerId = null;
  }

  const offerPayload = {
    sku,
    marketplaceId: "EBAY_US",
    format: "FIXED_PRICE",
    availableQuantity: qty,
    categoryId: "9355",
    listingDescription: product.title ?? `Amazon ASIN: ${product.asin}`,
    pricingSummary: {
      price: {
        value: price.toFixed(2),
        currency: "USD",
      },
    },
    listingPolicies: {
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID ?? "",
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID ?? "",
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID ?? "",
    },
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY ?? "default",
  };

  if (!offerId) {
    const createResp = await client.post<OfferResponse>(
      `/sell/inventory/v1/offer`,
      offerPayload
    );
    offerId = createResp.offerId ?? null;
  } else {
    await client.put(`/sell/inventory/v1/offer/${offerId}`, offerPayload);
  }

  if (!offerId) {
    throw new Error(`Offer ID alınamadı — SKU: ${sku}`);
  }

  // 3. Offer'ı yayınla
  const publishResp = await client.post<OfferResponse>(
    `/sell/inventory/v1/offer/${offerId}/publish`,
    {}
  );

  const listingId = publishResp.listingId;
  if (!listingId) {
    throw new Error(`Listing ID alınamadı — offerId: ${offerId}`);
  }

  return { listingId, offerId, sku };
}

// pauseListing, resumeListing, updatePriceAndQty → src/lib/ebay/inventory.ts'e
// taşındı. Yeni sürümler getValidToken + EbayClient kullanır ve ebayAccountId
// (string) alır. Buradan kaldırıldı; çağıranlar yeni modülü import eder.
