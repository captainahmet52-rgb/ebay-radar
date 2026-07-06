/**
 * Admin bildirimleri — özellikle kredi cüzdanı (bakiye) uyarıları.
 *
 * Kritik iş kuralı: kullanıcının bakiyesi biterse takip kodu (tracking) dönüşümü
 * yapılamaz → sipariş geçerli kargosuz kalır → eBay hesap riski. Bu yüzden bakiye
 * bitince/azalınca admin panele bildirim düşer; admin görüp yükletir/uyarır.
 */

import { prisma } from "@/lib/prisma";

/** Bu eşiğin altına düşen bakiye için "düşük bakiye" uyarısı üretilir (USD). */
export const LOW_BALANCE_THRESHOLD_USD = 2;

/**
 * Aynı kullanıcı + tip için OKUNMAMIŞ bir bildirim varsa tekrar oluşturmaz
 * (admin paneli spam'lenmesin). Yeni bildirim oluşturduysa true döner.
 */
async function createIfNotDuplicate(params: {
  type: string;
  title: string;
  message: string;
  userId?: string | null;
  userEmail?: string | null;
}): Promise<boolean> {
  const existing = await prisma.adminNotification.findFirst({
    where: { type: params.type, userId: params.userId ?? null, isRead: false },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.adminNotification.create({
    data: {
      type: params.type,
      title: params.title,
      message: params.message,
      userId: params.userId ?? null,
      userEmail: params.userEmail ?? null,
    },
  });
  return true;
}

/**
 * Döviz kuru API'si uzun süre erişilemez ve sistem bayat/statik kurla fiyatlama
 * yapmak zorunda kaldığında admin'e uyarı — yanlış marjla satış riski.
 */
export async function notifyExchangeRateStale(detail: string): Promise<void> {
  await createIfNotDuplicate({
    type: "exchange_rate_stale",
    title: "⚠️ Döviz kuru güncellenemiyor",
    message: `Fiyat hesaplamaları güncel olmayan kurla yapılıyor. ${detail}`,
  });
}

/** Bakiye yetersiz olduğu için bir işlem yapılamadı → admin paneline KRİTİK uyarı. */
export async function notifyInsufficientBalance(
  userId: string,
  context = "takip kodu çevirme"
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, creditBalanceUsd: true },
  });
  await createIfNotDuplicate({
    type: "balance_empty",
    title: "Bakiye yetersiz — işlem yapılamadı",
    message: `${user?.email ?? userId} kullanıcısının bakiyesi yetersiz ($${(user?.creditBalanceUsd ?? 0).toFixed(2)}). "${context}" yapılamadı. Bakiye yüklenmeli.`,
    userId,
    userEmail: user?.email ?? null,
  });
}

/**
 * Sahibin TrackCaptain kredisi bitti → admin paneline KRİTİK uyarı.
 * Bu kredi biterse HİÇBİR müşteri geçerli takip numarası alamaz → toplu eBay riski.
 */
export async function notifyTrackCaptainOutOfCredits(creditBalance = 0): Promise<void> {
  await createIfNotDuplicate({
    type: "trackcaptain_credits",
    title: "TrackCaptain kredisi BİTTİ (sahibin hesabı)",
    message: `TrackCaptain kredisi tükendi (kalan: ${creditBalance}). HİÇBİR müşteri takip numarası alamaz → eBay hesap riski. ACİL kredi yükle: trackcaptain.com`,
  });
}

/**
 * Scraper (ScrapingBee) kotası/kredisi bitti → admin paneline KRİTİK uyarı.
 * Bu biterse TÜM stok/fiyat takibi durur → oversell + eBay hesap riski.
 */
export async function notifyScraperOutOfCredits(detail = ""): Promise<void> {
  await createIfNotDuplicate({
    type: "scraper_credits",
    title: "Scraper kotası BİTTİ (ScrapingBee)",
    message: `ScrapingBee kotası/kredisi tükendi${detail ? ` (${detail})` : ""}. TÜM stok/fiyat takibi durdu → oversell riski. ACİL kota yükle: scrapingbee.com`,
  });
}

/**
 * Scraper kotası eşiği (örn. %80) geçti → admin paneline ÖN-UYARI (kota bitmeden).
 * Kota bitmeden haber verir ki sürpriz kesinti olmasın.
 */
export async function notifyScraperQuotaLow(used: number, max: number, pct: number): Promise<void> {
  await createIfNotDuplicate({
    type: "scraper_quota_low",
    title: `Scraper kotası %${Math.round(pct * 100)} doldu`,
    message: `ScrapingBee kotası ${used}/${max} (%${Math.round(pct * 100)}) kullanıldı. Bitmeden kota yükle — bitince TÜM stok takibi durur: scrapingbee.com`,
  });
}

/**
 * Scraper sürekli hata veriyor (kota dışı) → admin paneline uyarı.
 * Tek tük hata normaldir; bu yalnızca bir ürün güvenlik için duraklatıldığında çağrılır.
 */
export async function notifyScraperFailing(asin: string, detail = ""): Promise<void> {
  await createIfNotDuplicate({
    type: "scraper_failing",
    title: "Stok taranamıyor — ürün güvenlik için duraklatıldı",
    message: `ASIN ${asin} uzun süredir taranamadı${detail ? ` (${detail})` : ""}. Bayat veriyle satış riskine karşı listing'leri duraklatıldı. Tarama düzelince otomatik geri açılır.`,
  });
}

/** Başarılı işlem sonrası bakiye eşiğin altına düştüyse → admin paneline UYARI. */
export async function notifyLowBalanceIfNeeded(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, creditBalanceUsd: true },
  });
  if (!user) return;
  if (user.creditBalanceUsd > LOW_BALANCE_THRESHOLD_USD) return;

  await createIfNotDuplicate({
    type: "balance_low",
    title: "Bakiye azaldı",
    message: `${user.email} kullanıcısının bakiyesi düşük: $${user.creditBalanceUsd.toFixed(2)}. Yakında işlem yapamayabilir.`,
    userId,
    userEmail: user.email,
  });
}
