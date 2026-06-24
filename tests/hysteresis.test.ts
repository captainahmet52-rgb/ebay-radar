import { describe, test, expect } from "vitest";
import { isSignificantChange, isPriceSpike } from "@/lib/repricer";

describe("isSignificantChange — fiyat histerezisi (%2)", () => {
  test("eski değer yoksa → her zaman anlamlı", () => {
    expect(isSignificantChange(null, 100)).toBe(true);
    expect(isSignificantChange(0, 100)).toBe(true);
  });
  test("%2'den küçük değişim → anlamsız (eBay'e dokunma)", () => {
    expect(isSignificantChange(100, 101)).toBe(false); // %1
  });
  test("%2 ve üzeri → anlamlı", () => {
    expect(isSignificantChange(100, 102)).toBe(true);
    expect(isSignificantChange(100, 90)).toBe(true);
  });
});

describe("isPriceSpike — %50 üstü artış", () => {
  test("%50 altı → spike değil", () => expect(isPriceSpike(100, 140)).toBe(false));
  test("%50 üstü → spike", () => expect(isPriceSpike(100, 160)).toBe(true));
  test("düşüş → spike değil", () => expect(isPriceSpike(100, 50)).toBe(false));
});
