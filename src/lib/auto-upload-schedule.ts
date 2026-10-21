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
 * - "daily"/"weekly": seçilen saat (Türkiye saati) en son geçtiğinden beri
 *   çalışmadıysa çalışır (weekly ayrıca ~6.5 gün bekler) — worker saatte bir
 *   tetiklendiği için seçilen saatte, kaçırılırsa bir sonraki nabızda çalışır.
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

  // "Seçilen saatin en son geçtiği andan beri hiç çalışmadıysa çalış":
  // - seçilen saatte çalışır,
  // - o saat kaçırılırsa (deploy/restart) sonraki nabızda BİR KEZ telafi eder,
  // - ertesi gün yine seçilen saate döner (telafi kalıcı kaymaya dönüşmez).
  // Önceki "20+ saat geçtiyse herhangi bir saatte" mantığı iş saatini her gün kaydırıyordu.
  const missedLatestSlot = lastRunAt.getTime() < latestSlotAt(scheduleHour, now).getTime();
  if (schedule === "daily") return missedLatestSlot;
  if (schedule === "weekly") return missedLatestSlot && hoursSinceLastRun >= WEEKLY_MIN_HOURS;

  return false;
}

// Arayüzdeki saat seçimi Türkiye saatidir (UTC+3, yaz saati uygulaması yok).
// Dünyaya açılınca kullanıcı başına saat dilimi saklanmalı.
const SCHEDULE_UTC_OFFSET_HOURS = 3;
const WEEKLY_MIN_HOURS = 24 * 6.5;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Seçilen yerel saatin (Türkiye) `now`dan önceki/eşit en son gerçekleştiği an (UTC). */
function latestSlotAt(scheduleHour: number, now: Date): Date {
  const offsetMs = SCHEDULE_UTC_OFFSET_HOURS * HOUR_MS;
  const local = new Date(now.getTime() + offsetMs);
  const slotLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), scheduleHour);
  const slot = slotLocal - offsetMs;
  return new Date(slot > now.getTime() ? slot - DAY_MS : slot);
}
