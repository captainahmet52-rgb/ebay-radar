import { describe, test, expect } from "vitest";
import { shouldRunScheduledUpload } from "@/lib/auto-upload-schedule";

describe("shouldRunScheduledUpload", () => {
  test("manual hiçbir zaman otomatik çalışmaz", () => {
    expect(shouldRunScheduledUpload("manual", 3, null, new Date())).toBe(false);
    expect(
      shouldRunScheduledUpload("manual", 3, new Date("2026-01-01T00:00:00Z"), new Date("2026-06-01T00:00:00Z"))
    ).toBe(false);
  });

  test("hiç çalışmamışsa (lastRunAt null) hemen çalışır", () => {
    expect(shouldRunScheduledUpload("daily", 9, null, new Date())).toBe(true);
    expect(shouldRunScheduledUpload("every_2h", 0, null, new Date())).toBe(true);
  });

  test("every_2h: 2 saat geçmeden çalışmaz, geçince çalışır", () => {
    const lastRun = new Date("2026-01-01T10:00:00Z");
    expect(shouldRunScheduledUpload("every_2h", 0, lastRun, new Date("2026-01-01T11:30:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("every_2h", 0, lastRun, new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });

  test("every_12h: eşik saat başında doğru çalışır", () => {
    const lastRun = new Date("2026-01-01T00:00:00Z");
    expect(shouldRunScheduledUpload("every_12h", 0, lastRun, new Date("2026-01-01T11:00:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("every_12h", 0, lastRun, new Date("2026-01-01T12:00:00Z"))).toBe(true);
  });

  test("daily: sadece seçilen saatte VE yeterince zaman geçtiyse çalışır", () => {
    const lastRun = new Date("2026-01-01T09:05:00Z");
    // Aynı gün farklı saat — saat uymuyor.
    expect(shouldRunScheduledUpload("daily", 9, lastRun, new Date("2026-01-01T14:00:00Z"))).toBe(false);
    // Ertesi gün saat 9 — 20 saatten fazla geçti VE saat uyuyor.
    expect(shouldRunScheduledUpload("daily", 9, lastRun, new Date("2026-01-02T09:00:00Z"))).toBe(true);
    // Saat uysa bile 20 saat geçmediyse (aynı saatte iki kez tetiklenme riski) çalışmaz.
    expect(shouldRunScheduledUpload("daily", 9, new Date("2026-01-02T08:50:00Z"), new Date("2026-01-02T09:00:00Z"))).toBe(false);
  });

  test("weekly: ~6.5 gün eşiği + saat eşleşmesi", () => {
    const lastRun = new Date("2026-01-01T09:00:00Z");
    expect(shouldRunScheduledUpload("weekly", 9, lastRun, new Date("2026-01-05T09:00:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("weekly", 9, lastRun, new Date("2026-01-08T09:00:00Z"))).toBe(true);
  });
});
