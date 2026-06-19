import { describe, test, expect } from "vitest";
import { calculateEbayPrice, determineQty } from "@/lib/repricer";
import { EBAY_MARKETPLACES } from "@/lib/ebay-markets";

describe("calculateEbayPrice — pazar başına ücret/KDV", () => {
  test("US: eski davranışla uyumlu (KDV yok)", () => {
    const r = calculateEbayPrice(100, 0.136, 0.2, EBAY_MARKETPLACES.EBAY_US);
    // (100 + 0.40) / (1 - 0.136 - 0.20) ≈ 151.2
    expect(r.ebayPrice).toBeGreaterThan(150);
    expect(r.ebayPrice).toBeLessThan(152);
  });

  test("UK: ücret KDV'si (%20) + düzenleme ücreti fiyatı US'ten yukarı çeker", () => {
    const us = calculateEbayPrice(100, 0.129, 0.2, EBAY_MARKETPLACES.EBAY_US);
    const uk = calculateEbayPrice(100, 0.129, 0.2, EBAY_MARKETPLACES.EBAY_GB);
    expect(uk.ebayPrice).toBeGreaterThan(us.ebayPrice);
  });

  test("komisyon+marj 1'i geçerse hata", () => {
    expect(() => calculateEbayPrice(100, 0.9, 0.2, EBAY_MARKETPLACES.EBAY_US)).toThrow();
  });
});

describe("determineQty", () => {
  test("in_stock → 2", () => expect(determineQty("in_stock", null)).toBe(2));
  test("low ≥3 → 1", () => expect(determineQty("low", 4)).toBe(1));
  test("low <3 → 0", () => expect(determineQty("low", 1)).toBe(0));
  test("out → 0", () => expect(determineQty("out", null)).toBe(0));
});
