// Shopify Admin GraphQL API istemcisi.
//
// Neden GraphQL: Shopify, REST Admin API'nin ürün uçlarını yeni uygulamalar
// için kullanımdan kaldırdı (2024+) — ürün/stok işlemleri GraphQL'den yürür.
//
// Retry politikası (eBay client ile aynı ruh): 429/5xx → backoff ile max 3
// deneme; THROTTLED GraphQL hatası da 429 gibi ele alınır. Token log'a yazılmaz.

// Shopify API sürümleri 12 ay desteklenir — 2024-10 artık kapalı (2026 itibarıyla).
// 2026-01, Temmuz 2026'da yayınlanmış en güncel KARARLI sürümlerden; kullandığımız
// productCreate / productVariantsBulkUpdate / inventorySetQuantities / orders
// uçlarının tamamı bu sürümde mevcut.
const API_VERSION = "2026-01";
const MAX_RETRIES = 3;

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt + Math.random() * 500, 8000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GraphQLError {
  message?: string;
  extensions?: { code?: string };
}

/**
 * Admin GraphQL çağrısı. `userErrors` kontrolü ÇAĞIRANIN sorumluluğundadır
 * (mutasyon başına alan adı değişir); bu fonksiyon taşıma/HTTP/throttle
 * hatalarını yönetir.
 */
export async function shopifyGraphql<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const url = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;

  let attempt = 0;
  for (;;) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30_000),
    });

    const retryableHttp = res.status === 429 || res.status >= 500;
    if (retryableHttp && attempt < MAX_RETRIES) {
      await sleep(backoffMs(attempt));
      attempt += 1;
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Shopify API hatası: ${res.status} — ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as { data?: T; errors?: GraphQLError[] };

    if (json.errors?.length) {
      const throttled = json.errors.some((e) => e.extensions?.code === "THROTTLED");
      if (throttled && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }
      throw new Error(
        `Shopify GraphQL hatası: ${json.errors.map((e) => e.message ?? "?").join("; ").slice(0, 300)}`
      );
    }

    if (json.data === undefined) throw new Error("Shopify GraphQL: data alanı boş döndü");
    return json.data;
  }
}
