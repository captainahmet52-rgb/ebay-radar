// Döviz kuru dönüşümü — open.er-api.com (ücretsiz, key gerektirmez)

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 saat

// ── Desteklenen para birimleri (Amazon market'leri ile eşleşir) ──
export const SUPPORTED_CURRENCIES = [
  "USD",
  "GBP",
  "EUR",
  "CAD",
  "TRY",
  "AUD",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * STATİK YEDEK KURLAR (USD bazlı: 1 USD = N birim).
 * SADECE fallback'tir — canlı API (open.er-api.com) çalışmazsa devreye girer.
 * Gerçek hesaplama her zaman önce canlı kuru dener. Bu değerler yaklaşık olup
 * piyasa dalgalanmasında bayatlar; canlı kur tercih edilir. (~2026 başı seviyesi.)
 */
const FALLBACK_RATES: Record<SupportedCurrency, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.37,
  TRY: 39.0,
  AUD: 1.55,
};

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RateCache | null = null;

/** Bayat kur uyarısı — süreç başına bir kez admin'e bildir (spam olmasın). */
let staleNotified = false;
async function notifyStaleRatesOnce(detail: string): Promise<void> {
  if (staleNotified) return;
  staleNotified = true;
  try {
    const { notifyExchangeRateStale } = await import("@/lib/admin-notify");
    await notifyExchangeRateStale(detail);
  } catch {
    // bildirim hatası kur akışını asla düşürmez
  }
}

async function fetchRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Exchange rate API hatası: ${res.status}`);

    const data = (await res.json()) as { rates?: Record<string, number> };
    if (!data.rates || typeof data.rates !== "object") {
      throw new Error("Exchange rate API: geçersiz yanıt");
    }
    cache = { rates: data.rates, fetchedAt: Date.now() };
    staleNotified = false; // canlı kur döndü → bir sonraki kesintide yeniden uyarabil
    return data.rates;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bilinmeyen hata";

    // 1. tercih: elde SÜRESİ GEÇMİŞ de olsa GERÇEK kur varsa onu kullan —
    // birkaç saatlik bayat gerçek kur, aylar önce yazılmış statik tahminden iyidir.
    if (cache) {
      const ageHours = Math.round((Date.now() - cache.fetchedAt) / 3600000);
      console.warn(`[exchange-rate] Canlı kur alınamadı (${msg}) → ${ageHours} saatlik önbellek kullanılıyor`);
      if (ageHours >= 24) {
        void notifyStaleRatesOnce(`Kur API'si ${ageHours} saattir erişilemiyor; ${ageHours} saatlik önbellek kullanılıyor.`);
      }
      return cache.rates;
    }

    // Son çare: statik yedek (yanlış fiyatlamadansa yaklaşık kur) + admin uyarısı.
    console.warn(`[exchange-rate] Canlı kur alınamadı (${msg}) → STATİK yedek kullanılıyor`);
    void notifyStaleRatesOnce(`Kur API'si erişilemiyor ve önbellek boş — statik yedek kurlar kullanılıyor: ${msg}`);
    return FALLBACK_RATES;
  }
}

// Amazon marketplace → para birimi
// NOT: scraper.ts'deki AMAZON_DOMAINS ile birebir aynı olmalı (US/UK/DE/FR/IT/ES/CA/TR).
export const MARKET_CURRENCY: Record<string, SupportedCurrency> = {
  US: "USD", // amazon.com
  UK: "GBP", // amazon.co.uk
  DE: "EUR", // amazon.de
  FR: "EUR", // amazon.fr
  IT: "EUR", // amazon.it
  ES: "EUR", // amazon.es
  CA: "CAD", // amazon.ca
  TR: "TRY", // amazon.com.tr
};

// eBay site → para birimi
export const EBAY_SITE_CURRENCY: Record<string, SupportedCurrency> = {
  EBAY_US: "USD",
  EBAY_GB: "GBP",
  EBAY_DE: "EUR",
  EBAY_FR: "EUR",
  EBAY_IT: "EUR",
  EBAY_ES: "EUR",
  EBAY_CA: "CAD",
  EBAY_AU: "AUD",
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
  const fromRate = rates[from] ?? FALLBACK_RATES[from as SupportedCurrency];
  const toRate = rates[to] ?? FALLBACK_RATES[to as SupportedCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Bilinmeyen para birimi: ${from} veya ${to}`);
  }

  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
}
