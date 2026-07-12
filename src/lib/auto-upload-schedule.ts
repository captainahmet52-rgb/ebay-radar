// eBay + Amazon oto-yükleme worker'larının PAYLAŞTIĞI zamanlama mantığı.
// Not: eBay'in "Sıklık" ayarı (uploadSchedule/uploadScheduleHour) daha önce
// SADECE kaydediliyordu, hiçbir worker'da okunmuyordu — cron hep sabit saatte
// TÜM kullanıcılar için çalışırdı. Bu fonksiyon o ayarı gerçekten uygular.
export type AutoUploadSchedule =
  | "every_2h"
  | "every_4h"
  | "every_6h"
  | "every_12h"
  | "daily"
  | "weekly"
  | "manual";

const INTERVAL_HOURS: Partial<Record<AutoUploadSchedule, number>> = {
  every_2h: 2,
  every_4h: 4,
  every_6h: 6,
  every_12h: 12,
};

/**
 * Kullanıcının seçtiği zamanlamaya göre ŞU AN çalışması gerekip gerekmediğini
 * belirler (saf fonksiyon). Toplu (tüm kullanıcılar) worker çalıştırmasında
 * her kullanıcı için ayrı ayrı çağrılır; "Şimdi Çalıştır" gibi tekil/manuel
 * tetiklemeler bu kontrolden GEÇMEZ (her zaman çalışır).
 *
 * - "manual": otomatik hiç çalışmaz.
 * - "every_Nh": son çalıştırmadan bu yana N saat geçtiyse çalışır.
 * - "daily"/"weekly": geçen süre eşiği aşıldıysa VE mevcut saat (UTC)
 *   kullanıcının seçtiği saatle eşleştiyse çalışır — worker saatte bir
 *   tetiklendiği için bu, günde/haftada tam bir kez çalışmayı garantiler.
 */
export function shouldRunScheduledUpload(
  schedule: AutoUploadSchedule,
  scheduleHour: number,
  lastRunAt: Date | null,
  now: Date
): boolean {
  if (schedule === "manual") return false;
  if (!lastRunAt) return true;

  const hoursSinceLastRun = (now.getTime() - lastRunAt.getTime()) / 3_600_000;

  const intervalHours = INTERVAL_HOURS[schedule];
  if (intervalHours != null) return hoursSinceLastRun >= intervalHours;

  const hourMatches = now.getUTCHours() === scheduleHour;
  if (schedule === "daily") return hourMatches && hoursSinceLastRun >= 20;
  if (schedule === "weekly") return hourMatches && hoursSinceLastRun >= 24 * 6.5;

  return false;
}
