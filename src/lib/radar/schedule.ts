// Oto-pilot zamanlama mantığı — bir mağaza ŞİMDİ taranmaya hazır mı? (saf, test edilebilir)
//
// scanIntervalHours <= 0 → oto-tarama KAPALI (manuel).
// lastScannedAt yok → hiç taranmamış → hazır.
// aksi halde son taramadan bu yana interval geçmişse → hazır.

export interface ScanScheduleInput {
  scanIntervalHours: number;
  lastScannedAt: Date | null;
}

export function isStoreDue(input: ScanScheduleInput, now: Date = new Date()): boolean {
  if (!Number.isFinite(input.scanIntervalHours) || input.scanIntervalHours <= 0) return false;
  if (!input.lastScannedAt) return true;
  const dueMs = input.scanIntervalHours * 60 * 60 * 1000;
  return now.getTime() - input.lastScannedAt.getTime() >= dueMs;
}

/** Aynı zaman penceresinde çift enqueue olmasın diye stabil jobId bucket'ı. */
export function scanBucket(scanIntervalHours: number, now: Date = new Date()): number {
  const dueMs = Math.max(1, scanIntervalHours) * 60 * 60 * 1000;
  return Math.floor(now.getTime() / dueMs);
}
