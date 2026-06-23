// eBay Inventory + Offer API orkestrasyonu
//
// eBay'de üç ayrı kavram vardır:
//   SKU       — inventory item'ı tanımlar; biz üretiyoruz: "EBAY-{asin}"
//   offerId   — fiyat/koşul kaydı; eBay tarafından atanır
//   listingId — marketplace'teki aktif ilan ID'si; publish sonrası döner
//
// publishListing 3 adımlı zinciri orkestre eder:
//   createOrReplaceInventoryItem (SKU)
//       → createOffer (offerId)
//       → publishOffer (listingId)
//
// Zincir resume edilebilir: her aşama Listing.publishStage'e yazılır.
// Bir aşamada hata olursa Listing.lastEbayError yazılır ve hata fırlatılır
// (çağıran BullMQ job retry yapar; sonraki deneme kalınan aşamadan devam eder).
//
// Güvenlik: token/secret ASLA log'a veya hata mesajına yazılmaz.
// Token her zaman getValidToken üzerinden alınır (gerekirse otomatik yenilenir).

import { prisma } from "@/lib/prisma";
import { EbayClient } from "@/lib/ebay/client";
import { getValidToken } from "@/lib/ebay/oauth";
import { checkPoliciesValid, getPolicyIds } from "@/lib/ebay/account";
import {
  getRequiredAspects,
  isConditionRequired,
} from "@/lib/ebay/taxonomy";
import { resolveEbayMarketplace } from "@/lib/ebay-markets";

// ─── publishStage sabitleri ────────────────────────────────────────────────────
// Sıralı aşamalar: <null> → inventory_done → offer_created → published
const STAGE_INVENTORY_DONE = "inventory_done";
const STAGE_OFFER_CREATED = "offer_created";
const STAGE_PUBLISHED = "published";

// Varsayılan eBay kategorisi (product.category yoksa) — Other / Misc
const DEFAULT_CATEGORY_ID = "9355";

// ─── Dönüş tipi ────────────────────────────────────────────────────────────────

/** publishListing dönüş tipi — DB'ye yazılan üç tanımlayıcı */
export interface ListingIdentifiers {
  listingId: string; // eBay marketplace listing ID
  offerId: string; // fiyat güncellemeleri için
  sku: string; // stok güncellemeleri için
}

// ─── eBay API yanıt şekilleri ─────────────────────────────────────────────────

interface CreateOfferResponse {
  offerId?: string;
}

interface PublishOfferResponse {
  listingId?: string;
}

// ─── Yardımcılar ───────────────────────────────────────────────────────────────

/** Bir EbayAccount için geçerli token ile EbayClient üretir. Token log'lanmaz. */
async function buildClient(ebayAccountId: string): Promise<EbayClient> {
  const token = await getValidToken(ebayAccountId);
  // 401 alınırsa client onRefresh ile tazelenmiş token'ı yeniden çeksin.
  return new EbayClient(token, undefined, () => getValidToken(ebayAccountId));
}

/** Zorunlu aspect adlarını eBay'in beklediği {name: [value]} şekline çevirir. */
function buildAspects(
  requiredAspectNames: string[],
  product: { title: string | null; asin: string }
): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};
  // Zorunlu aspect'ler için doldurulmuş değerimiz yok; "Unbranded"/"Does Not Apply"
  // ile minimum geçerli payload üretilir. Gerçek değerler ileride zenginleştirilebilir.
  for (const name of requiredAspectNames) {
    const lower = name.toLowerCase();
    if (lower === "brand") {
      aspects[name] = ["Unbranded"];
    } else if (lower === "mpn") {
      aspects[name] = ["Does Not Apply"];
    } else {
      aspects[name] = ["Does Not Apply"];
    }
  }
  return aspects;
}

/** Listing.lastEbayError alanına hata mesajını yazar (sessiz catch yok). */
async function recordError(listingId: string, message: string): Promise<void> {
  await prisma.listing.update({
    where: { id: listingId },
    data: { lastEbayError: message },
  });
}

// ─── Ana fonksiyon ─────────────────────────────────────────────────────────────

/**
 * Bir Listing kaydını eBay'de yayınlar (3 adımlı zincir).
 *
 * @param ebayAccountId Hedef eBay hesabının ID'si
 * @param listingId     Bizim Prisma Listing kaydımızın ID'si
 * @returns { listingId, offerId, sku } — DB'ye zaten yazılır, çağırana da döner
 *
 * Zincir publishStage'e göre resume edilebilir; her aşama ayrı try/catch içinde
 * çalışır, hata olursa Listing.lastEbayError yazılır ve hata yeniden fırlatılır.
 */
export async function publishListing(
  ebayAccountId: string,
  listingId: string
): Promise<ListingIdentifiers> {
  // 1. Listing + Product + EbayAccount çek
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: { product: true, ebayAccount: true },
  });

  if (!listing) {
    throw new Error(`Listing bulunamadı: ${listingId}`);
  }
  if (listing.ebayAccountId !== ebayAccountId) {
    throw new Error(
      `Listing ${listingId} bu eBay hesabına ait değil: ${ebayAccountId}`
    );
  }

  const { product } = listing;

  // 2. Politikaları doğrula — eksikse fırlat
  const policyCheck = await checkPoliciesValid(ebayAccountId);
  if (!policyCheck.valid) {
    const msg = `eBay politikaları eksik: ${policyCheck.missing.join(", ")}`;
    await recordError(listingId, msg);
    throw new Error(msg);
  }

  const policies = await getPolicyIds(ebayAccountId);

  const categoryId = product.category ?? DEFAULT_CATEGORY_ID;

  // 3. Kategori için zorunlu aspect'leri çek
  const requiredAspectNames = await getRequiredAspects(categoryId);

  // 4. Condition gerekip gerekmediğini kontrol et (her durumda NEW gönderiyoruz)
  await isConditionRequired(categoryId);

  const sku = listing.ebaySku ?? `EBAY-${product.asin}`;
  const qty = listing.currentQty;
  const price = listing.currentPrice;

  if (price === null) {
    const msg = `Listing ${listingId} için fiyat (currentPrice) hesaplanmamış`;
    await recordError(listingId, msg);
    throw new Error(msg);
  }

  const client = await buildClient(ebayAccountId);
  const stage = listing.publishStage;

  // ── AŞAMA 1: inventory_item ─────────────────────────────────────────────────
  const inventoryDone =
    stage === STAGE_INVENTORY_DONE ||
    stage === STAGE_OFFER_CREATED ||
    stage === STAGE_PUBLISHED;

  if (!inventoryDone) {
    try {
      const aspects = buildAspects(requiredAspectNames, product);
      await client.put(
        `/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
        {
          availability: {
            shipToLocationAvailability: { quantity: qty },
          },
          condition: "NEW",
          product: {
            title: product.title ?? `Amazon ASIN: ${product.asin}`,
            description: product.title ?? `Amazon ASIN: ${product.asin}`,
            imageUrls: product.imageUrl ? [product.imageUrl] : [],
            ...(Object.keys(aspects).length > 0 ? { aspects } : {}),
          },
        }
      );

      await prisma.listing.update({
        where: { id: listingId },
        data: {
          ebaySku: sku,
          publishStage: STAGE_INVENTORY_DONE,
          lastEbayError: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordError(listingId, `inventory_item aşaması: ${msg}`);
      throw err;
    }
  }

  // ── AŞAMA 2: offer ──────────────────────────────────────────────────────────
  let offerId = listing.ebayOfferId ?? null;
  const offerDone =
    stage === STAGE_OFFER_CREATED || stage === STAGE_PUBLISHED;

  // Mağazanın pazarı + para birimi (multi-market: US/UK/DE/AU)
  const marketplace = resolveEbayMarketplace(listing.ebaySite);

  if (!offerDone && !offerId) {
    try {
      const createResp = await client.post<CreateOfferResponse>(
        `/sell/inventory/v1/offer`,
        {
          sku,
          marketplaceId: marketplace.key,
          format: "FIXED_PRICE",
          availableQuantity: qty,
          categoryId,
          listingPolicies: {
            fulfillmentPolicyId: policies.fulfillmentPolicyId,
            paymentPolicyId: policies.paymentPolicyId,
            returnPolicyId: policies.returnPolicyId,
          },
          merchantLocationKey: policies.merchantLocationKey,
          pricingSummary: {
            price: {
              value: price.toFixed(2),
              currency: marketplace.currency,
            },
          },
        }
      );

      offerId = createResp.offerId ?? null;
      if (!offerId) {
        throw new Error(`Offer ID alınamadı — SKU: ${sku}`);
      }

      await prisma.listing.update({
        where: { id: listingId },
        data: {
          ebayOfferId: offerId,
          publishStage: STAGE_OFFER_CREATED,
          lastEbayError: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordError(listingId, `offer aşaması: ${msg}`);
      throw err;
    }
  }

  if (!offerId) {
    const msg = `Offer ID yok — publish edilemiyor (SKU: ${sku})`;
    await recordError(listingId, msg);
    throw new Error(msg);
  }

  // ── AŞAMA 3: publish ────────────────────────────────────────────────────────
  let marketplaceListingId = listing.ebayListingId ?? null;

  if (stage !== STAGE_PUBLISHED) {
    try {
      const publishResp = await client.post<PublishOfferResponse>(
        `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
        {}
      );

      marketplaceListingId = publishResp.listingId ?? null;
      if (!marketplaceListingId) {
        throw new Error(`Listing ID alınamadı — offerId: ${offerId}`);
      }

      await prisma.listing.update({
        where: { id: listingId },
        data: {
          ebayListingId: marketplaceListingId,
          publishStage: STAGE_PUBLISHED,
          status: "active",
          lastEbayError: null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await recordError(listingId, `publish aşaması: ${msg}`);
      throw err;
    }
  }

  if (!marketplaceListingId) {
    const msg = `Listing ID yok — publish tamamlanamadı (offerId: ${offerId})`;
    await recordError(listingId, msg);
    throw new Error(msg);
  }

  return { listingId: marketplaceListingId, offerId, sku };
}

// ─── Listing durdurma / açma / güncelleme ──────────────────────────────────────

/**
 * Listing'i durdur (qty 0). Silmez — sadece stoğu sıfırlar.
 * bulk_update_price_quantity SKU alır — listingId ile çağrılmamalı.
 */
export async function pauseListing(
  ebayAccountId: string,
  sku: string
): Promise<void> {
  const client = await buildClient(ebayAccountId);

  await client.post(`/sell/inventory/v1/bulk_update_price_quantity`, {
    requests: [
      {
        sku,
        shipToLocationAvailability: { quantity: 0 },
      },
    ],
  });
}

/**
 * Listing'i yeniden aktif et.
 * Çağırandan ÖNCE fiyat yeniden hesaplanmış olmalı (CLAUDE.md Bölüm 4).
 * SKU ile stok açılır, offerId ile fiyat güncellenir.
 */
export async function resumeListing(
  ebayAccountId: string,
  sku: string,
  offerId: string,
  qty: number,
  price: number
): Promise<void> {
  await updatePriceAndQty(ebayAccountId, sku, offerId, price, qty);
}

/**
 * Fiyat ve adedi tek çağrıda güncelle.
 * SKU → stok (shipToLocationAvailability)
 * offerId → fiyat (offers[].offerId)
 */
export async function updatePriceAndQty(
  ebayAccountId: string,
  sku: string,
  offerId: string,
  price: number,
  qty: number,
  currency: string = "USD"
): Promise<void> {
  const client = await buildClient(ebayAccountId);

  await client.post(`/sell/inventory/v1/bulk_update_price_quantity`, {
    requests: [
      {
        sku,
        shipToLocationAvailability: { quantity: qty },
        offers: [
          {
            availableQuantity: qty,
            offerId,
            price: {
              currency,
              value: price.toFixed(2),
            },
          },
        ],
      },
    ],
  });
}
