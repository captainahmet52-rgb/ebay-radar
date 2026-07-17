// Shopify ürün işlemleri (Admin GraphQL, 2024-10).
//
// NOT (doğrulama): Bu modül SHOPIFY_APP_KEY/SECRET bağlanıp gerçek bir mağazayla
// test edilene kadar canlıda ÇALIŞTIRILMAMIŞTIR — GraphQL şemaları Shopify
// dokümantasyonuna göre yazıldı; ilk gerçek bağlantıda loglar izlenmeli.
//
// Akış:
//   create: productCreate (varsayılan varyantla) → productVariantsBulkUpdate
//           (fiyat + stok takibi) → inventorySetQuantities (adet) →
//           productCreateMedia (görsel, best-effort)
//   update: fiyat/adet değişimi
//   pause : ürün DRAFT'a çekilir + adet 0 (vitrinden kalkar, oversell imkansız)

import { shopifyGraphql } from "./client";

export interface ShopifyProductIds {
  productId: string;
  variantId: string;
  inventoryItemId: string;
}

interface UserError {
  field?: string[] | null;
  message: string;
}

function assertNoUserErrors(prefix: string, errors: UserError[] | undefined | null): void {
  if (errors && errors.length > 0) {
    throw new Error(`${prefix}: ${errors.map((e) => e.message).join("; ").slice(0, 300)}`);
  }
}

/** Mağazanın birincil lokasyonu (stok adetleri lokasyon başına yazılır). */
async function getPrimaryLocationId(shopDomain: string, token: string): Promise<string> {
  const data = await shopifyGraphql<{
    locations: { nodes: Array<{ id: string }> };
  }>(shopDomain, token, `{ locations(first: 1) { nodes { id } } }`);

  const id = data.locations.nodes[0]?.id;
  if (!id) throw new Error("Shopify lokasyonu bulunamadı (mağazada en az 1 lokasyon olmalı)");
  return id;
}

async function setInventoryQuantity(
  shopDomain: string,
  token: string,
  inventoryItemId: string,
  qty: number
): Promise<void> {
  const locationId = await getPrimaryLocationId(shopDomain, token);
  const data = await shopifyGraphql<{
    inventorySetQuantities: { userErrors: UserError[] };
  }>(
    shopDomain,
    token,
    `mutation($input: InventorySetQuantitiesInput!) {
      inventorySetQuantities(input: $input) { userErrors { field message } }
    }`,
    {
      input: {
        reason: "correction",
        name: "available",
        ignoreCompareQuantity: true,
        quantities: [{ inventoryItemId, locationId, quantity: qty }],
      },
    }
  );
  assertNoUserErrors("inventorySetQuantities", data.inventorySetQuantities.userErrors);
}

async function setVariantPrice(
  shopDomain: string,
  token: string,
  productId: string,
  variantId: string,
  price: number
): Promise<void> {
  const data = await shopifyGraphql<{
    productVariantsBulkUpdate: { userErrors: UserError[] };
  }>(
    shopDomain,
    token,
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        userErrors { field message }
      }
    }`,
    {
      productId,
      variants: [{ id: variantId, price: price.toFixed(2), inventoryItem: { tracked: true } }],
    }
  );
  assertNoUserErrors("productVariantsBulkUpdate", data.productVariantsBulkUpdate.userErrors);
}

/** Yeni ürün oluşturur; varsayılan varyanta fiyat + stok yazar, görseli ekler. */
export async function createShopifyProduct(
  shopDomain: string,
  token: string,
  input: { title: string; imageUrl?: string | null; price: number; qty: number }
): Promise<ShopifyProductIds> {
  const created = await shopifyGraphql<{
    productCreate: {
      product: {
        id: string;
        variants: { nodes: Array<{ id: string; inventoryItem: { id: string } }> };
      } | null;
      userErrors: UserError[];
    };
  }>(
    shopDomain,
    token,
    `mutation($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          variants(first: 1) { nodes { id inventoryItem { id } } }
        }
        userErrors { field message }
      }
    }`,
    { input: { title: input.title, status: "ACTIVE" } }
  );
  assertNoUserErrors("productCreate", created.productCreate.userErrors);

  const product = created.productCreate.product;
  const variant = product?.variants.nodes[0];
  if (!product || !variant) throw new Error("productCreate: ürün/varyant dönmedi");

  await setVariantPrice(shopDomain, token, product.id, variant.id, input.price);
  await setInventoryQuantity(shopDomain, token, variant.inventoryItem.id, input.qty);

  // Görsel best-effort — görsel eklenemedi diye yükleme FAIL olmaz
  if (input.imageUrl) {
    try {
      const media = await shopifyGraphql<{
        productCreateMedia: { mediaUserErrors: UserError[] };
      }>(
        shopDomain,
        token,
        `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
          productCreateMedia(productId: $productId, media: $media) {
            mediaUserErrors { field message }
          }
        }`,
        {
          productId: product.id,
          media: [{ originalSource: input.imageUrl, mediaContentType: "IMAGE" }],
        }
      );
      assertNoUserErrors("productCreateMedia", media.productCreateMedia.mediaUserErrors);
    } catch (err) {
      console.warn("[shopify] görsel eklenemedi (ürün yine de oluştu):", err instanceof Error ? err.message : err);
    }
  }

  return {
    productId: product.id,
    variantId: variant.id,
    inventoryItemId: variant.inventoryItem.id,
  };
}

/** Mevcut listelemenin fiyat + adedini günceller. */
export async function updateShopifyListing(
  shopDomain: string,
  token: string,
  ids: ShopifyProductIds,
  price: number,
  qty: number
): Promise<void> {
  await setVariantPrice(shopDomain, token, ids.productId, ids.variantId, price);
  await setInventoryQuantity(shopDomain, token, ids.inventoryItemId, qty);
}

/** Ürünü vitrine açar/kapatır. Pause = DRAFT + adet 0 (oversell imkansız). */
export async function setShopifyProductStatus(
  shopDomain: string,
  token: string,
  productId: string,
  status: "ACTIVE" | "DRAFT"
): Promise<void> {
  const data = await shopifyGraphql<{
    productUpdate: { userErrors: UserError[] };
  }>(
    shopDomain,
    token,
    `mutation($input: ProductInput!) {
      productUpdate(input: $input) { userErrors { field message } }
    }`,
    { input: { id: productId, status } }
  );
  assertNoUserErrors("productUpdate", data.productUpdate.userErrors);
}
