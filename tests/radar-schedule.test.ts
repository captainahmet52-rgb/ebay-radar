import { describe, test, expect } from "vitest";
import { isStoreDue, scanBucket } from "@/lib/radar/schedule";

const now = new Date("2026-06-29T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe("isStoreDue", () => {
  test("interval 0 → oto-tarama kapalı (manuel)", () => {
    expect(isStoreDue({ scanIntervalHours: 0, lastScannedAt: hoursAgo(100) }, now)).toBe(false);
  });
  test("negatif interval → kapalı", () => {
    expect(isStoreDue({ scanIntervalHours: -5, lastScannedAt: null }, now)).toBe(false);
  });
  test("hiç taranmamış → hazır", () => {
    expect(isStoreDue({ scanIntervalHours: 12, lastScannedAt: null }, now)).toBe(true);
  });
  test("interval geçti → hazır", () => {
    expect(isStoreDue({ scanIntervalHours: 12, lastScannedAt: hoursAgo(13) }, now)).toBe(true);
  });
  test("interval geçmedi → hazır değil", () => {
    expect(isStoreDue({ scanIntervalHours: 12, lastScannedAt: hoursAgo(2) }, now)).toBe(false);
  });
  test("tam sınırda (=interval) → hazır", () => {
    expect(isStoreDue({ scanIntervalHours: 12, lastScannedAt: hoursAgo(12) }, now)).toBe(true);
  });
});

describe("scanBucket", () => {
  test("aynı pencerede aynı bucket (çift enqueue önleme)", () => {
    const t1 = new Date("2026-06-29T12:00:00Z");
    const t2 = new Date("2026-06-29T17:00:00Z"); // 12s pencere içinde
    expect(scanBucket(12, t1)).toBe(scanBucket(12, t2));
  });
  test("farklı pencerede farklı bucket", () => {
    const t1 = new Date("2026-06-29T00:00:00Z");
    const t2 = new Date("2026-06-30T00:00:00Z"); // +24s → 2 pencere ileri (12s)
    expect(scanBucket(12, t1)).not.toBe(scanBucket(12, t2));
  });
});
