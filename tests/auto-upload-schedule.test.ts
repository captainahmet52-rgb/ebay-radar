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

  test("daily: 20 saat geçti diye seçilen saatten ÖNCE çalışmaz (kayma hatası)", () => {
    // Saat 9 (Türkiye) = 06:00 UTC. Dün 06:05 UTC'de çalıştı.
    const lastRun = new Date("2026-01-01T06:05:00Z");
    // Ertesi gün 03:00 UTC (Türkiye 06:00) — 20+ saat geçti ama saat 9 henüz gelmedi.
    expect(shouldRunScheduledUpload("daily", 9, lastRun, new Date("2026-01-02T03:00:00Z"))).toBe(false);
    // Türkiye saati 9 olunca çalışır.
    expect(shouldRunScheduledUpload("daily", 9, lastRun, new Date("2026-01-02T06:00:00Z"))).toBe(true);
  });

  test("daily: seçilen saat kaçırılırsa bir kez telafi eder, ertesi gün yine seçilen saate döner", () => {
    // Son çalışma 2 gün önce; saat 9 (Türkiye) bugün kaçırıldı (deploy vb.).
    const lastRun = new Date("2026-01-01T06:00:00Z");
    const catchUp = new Date("2026-01-03T15:00:00Z");
    expect(shouldRunScheduledUpload("daily", 9, lastRun, catchUp)).toBe(true);
    // Telafiden sonra aynı gün tekrar çalışmaz.
    expect(shouldRunScheduledUpload("daily", 9, catchUp, new Date("2026-01-03T20:00:00Z"))).toBe(false);
    // Ertesi gün seçilen saatten önce çalışmaz, seçilen saatte çalışır (kayma kalıcı olmaz).
    expect(shouldRunScheduledUpload("daily", 9, catchUp, new Date("2026-01-04T05:00:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("daily", 9, catchUp, new Date("2026-01-04T06:00:00Z"))).toBe(true);
  });

  test("daily: seçilen saat Türkiye saatidir (UTC+3)", () => {
    const lastRun = new Date("2026-01-01T06:00:00Z");
    // Türkiye 00:00 = önceki gün 21:00 UTC — gece yarısı seçimi gün sınırında doğru hesaplanır.
    expect(shouldRunScheduledUpload("daily", 0, lastRun, new Date("2026-01-01T20:59:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("daily", 0, lastRun, new Date("2026-01-01T21:00:00Z"))).toBe(true);
  });

  test("weekly: ~6.5 gün eşiği + saat eşleşmesi", () => {
    const lastRun = new Date("2026-01-01T09:00:00Z");
    expect(shouldRunScheduledUpload("weekly", 9, lastRun, new Date("2026-01-05T09:00:00Z"))).toBe(false);
    expect(shouldRunScheduledUpload("weekly", 9, lastRun, new Date("2026-01-08T09:00:00Z"))).toBe(true);
  });
});
