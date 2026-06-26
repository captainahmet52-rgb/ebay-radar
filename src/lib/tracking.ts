/**
 * Takip kodu çevirme — AliExpress (Cainiao/YunExpress) numarasını Amazon'da
 * GEÇERLİ son-mil kargo numarasına (USPS/Royal Mail vb.) çevirir.
 * Sağlayıcı: 17track (varsayılan) veya AfterShip. env gelince canlı çalışır.
 *
 * İş kuralı: AliExpress'in ilk numarası Amazon'da geçersizdir; paket varış ülkesine
 * ulaşıp yerel kargoya devredilince doğan numara geçerlidir. Bu fonksiyon onu bulur.
 */

import {
  isTrackCaptainConfigured,
  matchAndClaim,
  type TrackCaptainDestination,
} from "@/lib/trackcaptain";

/** Çevirme başına kullanıcıdan düşülecek ücret (USD). 10 TL ≈ $0.43. */
export const TRACKING_CONVERSION_FEE_USD = 0.43;

export interface TrackingConversion {
  carrierCode: string;   // ör. "usps", "fedex"
  trackingNumber: string;
  delivered: boolean;
}

export function isTrackingProviderConfigured(): boolean {
  return (
    isTrackCaptainConfigured() ||
    Boolean(process.env.SEVENTEENTRACK_API_KEY || process.env.AFTERSHIP_API_KEY)
  );
}

/**
 * Sipariş için eBay/Amazon'un kabul edeceği GEÇERLİ takip numarası üretir.
 * Birincil sağlayıcı: TrackCaptain (varış adresine uyan gerçek USPS/FedEx no).
 * `destination` opsiyoneldir; verilirse (zip/şehir/eyalet) numara kalitesi artar.
 *
 * @throws sağlayıcı bağlı değilse veya TrackCaptain kredisi bitmişse
 *   (TrackCaptainOutOfCreditsError — çağıran tarafta admin'e bildirilir).
 */
export async function convertTracking(
  aliTrackingNo: string,
  destination?: TrackCaptainDestination
): Promise<TrackingConversion> {
  if (isTrackCaptainConfigured()) {
    const claimed = await matchAndClaim(destination ?? {});
    const delivered = claimed.deliveryDate
      ? new Date(claimed.deliveryDate).getTime() <= Date.now()
      : false;
    return {
      carrierCode: claimed.carrier.toLowerCase(), // "usps" | "fedex"
      trackingNumber: claimed.trackingNumber,
      delivered,
    };
  }

  // Yedek sağlayıcılar (henüz tamamlanmadı). Hata mesajına müşteri verisi (takip no)
  // KOYMA — client'a sızabilir. Detayı sadece server log'una yaz.
  console.error(`[tracking] Sağlayıcı bağlı değil (TRACKCAPTAIN_API_KEY yok). aliTrackingNo=${aliTrackingNo}`);
  throw new Error("Takip sağlayıcısı yapılandırılmadı");
}
