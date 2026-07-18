// Shopify Admin GraphQL — sipariş çekme.
//
// GİZLİLİK KARARI: müşteri PII'ı (shippingAddress, customer, email) SORGULANMAZ.
// Bu alanlar Shopify'da "protected customer data" kapsamında — App Store onayı
// öncesi erişim yoktur ve mağaza sahibi kargo adresini zaten kendi Shopify
// panelinde görür. Biz yalnız sipariş özetini çekeriz; GDPR webhook'ları da
// bu sayede basit kalır (silecek müşteri verimiz yok).

import { shopifyGraphql } from "./client";

export interface ShopifyOrderLineItem {
  title: string;
  quantity: number;
  // gid://shopify/Product/123 — ShopifyListing.shopifyProductId ile eşlenir
  shopifyProductId: string | null;
}

export interface FetchedShopifyOrder {
  shopifyOrderId: string; // GID
  name: string;
  createdAt: string; // ISO
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  totalPrice: number;
  currency: string;
  lineItems: ShopifyOrderLineItem[];
}

interface OrdersQueryResult {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: Array<{
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string | null;
        displayFulfillmentStatus: string | null;
        totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
        lineItems: {
          edges: Array<{
            node: { title: string; quantity: number; product: { id: string } | null };
          }>;
        };
      };
    }>;
  };
}

const ORDERS_QUERY = /* GraphQL */ `
  query PollOrders($first: Int!, $query: String!, $after: String) {
    orders(first: $first, query: $query, after: $after, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          lineItems(first: 25) {
            edges {
              node {
                title
                quantity
                product {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Tek turda en fazla bu kadar sipariş çekilir (50'lik 5 sayfa) — bir mağazaya
// 30 dakikada 250'den fazla sipariş düşüyorsa kalan sonraki turda tamamlanır
// (imleç lastOrdersSyncAt olduğu için kayıp olmaz, sadece gecikir).
const PAGE_SIZE = 50;
const MAX_PAGES = 5;

/** `since` tarihinden bugüne siparişleri çeker (sayfalı, en eski → en yeni). */
export async function fetchShopifyOrders(
  shopDomain: string,
  accessToken: string,
  since: Date
): Promise<FetchedShopifyOrder[]> {
  const query = `created_at:>='${since.toISOString()}'`;
  const out: FetchedShopifyOrder[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const data: OrdersQueryResult = await shopifyGraphql<OrdersQueryResult>(
      shopDomain,
      accessToken,
      ORDERS_QUERY,
      { first: PAGE_SIZE, query, after }
    );

    for (const edge of data.orders.edges) {
      const n = edge.node;
      out.push({
        shopifyOrderId: n.id,
        name: n.name,
        createdAt: n.createdAt,
        financialStatus: n.displayFinancialStatus,
        fulfillmentStatus: n.displayFulfillmentStatus,
        totalPrice: parseFloat(n.totalPriceSet.shopMoney.amount) || 0,
        currency: n.totalPriceSet.shopMoney.currencyCode || "USD",
        lineItems: n.lineItems.edges.map((li) => ({
          title: li.node.title,
          quantity: li.node.quantity,
          shopifyProductId: li.node.product?.id ?? null,
        })),
      });
    }

    if (!data.orders.pageInfo.hasNextPage || !data.orders.pageInfo.endCursor) break;
    after = data.orders.pageInfo.endCursor;
  }

  return out;
}
