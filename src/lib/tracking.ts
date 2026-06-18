/**
 * Takip kodu çevirme — AliExpress (Cainiao/YunExpress) numarasını Amazon'da
 * GEÇERLİ son-mil kargo numarasına (USPS/Royal Mail vb.) çevirir.
 * Sağlayıcı: 17track (varsayılan) veya AfterShip. env gelince canlı çalışır.
 *
 * İş kuralı: AliExpress'in ilk numarası Amazon'da geçersizdir; paket varış ülkesine
 * ulaşıp yerel kargoya devredilince doğan numara geçerlidir. Bu fonksiyon onu bulur.
 */

/** Çevirme başına kullanıcıdan düşülecek ücret (USD). 10 TL ≈ $0.43. */
export const TRACKING_CONVERSION_FEE_USD = 0.43;

export interface TrackingConversion {
  carrierCode: string;   // ör. "usps", "royal-mail"
  trackingNumber: string;
  delivered: boolean;
}

export function isTrackingProviderConfigured(): boolean {
  return Boolean(process.env.SEVENTEENTRACK_API_KEY || process.env.AFTERSHIP_API_KEY);
}

/**
 * AliExpress takip numarasını geçerli son-mil numarasına çevirir.
 * @throws sağlayıcı bağlı değilse ya da son-mil numara henüz oluşmadıysa.
 */
export async function convertTracking(aliTrackingNo: string): Promise<TrackingConversion> {
  if (!isTrackingProviderConfigured()) {
    throw new Error(
      "Takip sağlayıcısı bağlı değil (SEVENTEENTRACK_API_KEY / AFTERSHIP_API_KEY yok). API en sonda bağlanacak."
    );
  }
  // TODO: 17track register + gettrackinfo → son-mil carrier + numara parse et.
  // Son-mil numara henüz yoksa "henüz hazır değil" hatası dön (kullanıcı sonra tekrar dener).
  throw new Error(`Takip çevirme entegrasyonu henüz tamamlanmadı (aliTrackingNo: ${aliTrackingNo}).`);
}
