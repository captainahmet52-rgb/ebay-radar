// Döviz kuru dönüşümü — open.er-api.com (ücretsiz, key gerektirmez)

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RateCache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Exchange rate API hatası: ${res.status}`);

  const data = (await res.json()) as { rates: Record<string, number> };
  cache = { rates: data.rates, fetchedAt: Date.now() };
  return data.rates;
}

// Amazon marketplace → para birimi
export const MARKET_CURRENCY: Record<string, string> = {
  US: "USD",
  UK: "GBP",
};

// eBay site → para birimi
export const EBAY_SITE_CURRENCY: Record<string, string> = {
  EBAY_US: "USD",
  EBAY_GB: "GBP",
};

/**
 * Bir para birimini diğerine çevirir.
 * Aynı para birimi ise dönüşüm yapmaz.
 */
export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  if (from === to) return amount;

  const rates = await fetchRates();

  // Tüm kurlar USD bazlı — from → USD → to
  const fromRate = rates[from];
  const toRate = rates[to];

  if (!fromRate || !toRate) {
    throw new Error(`Bilinmeyen para birimi: ${from} veya ${to}`);
  }

  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}
