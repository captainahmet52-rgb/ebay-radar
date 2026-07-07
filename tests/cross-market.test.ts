import { describe, test, expect } from "vitest";
import {
  isCrossMarket,
  resolveExtraCosts,
  DEFAULT_EBAY_INTL_FEE_PCT,
  DEFAULT_EBAY_FX_FEE_PCT,
} from "@/lib/cross-market";

describe("isCrossMarket", () => {
  test("US Amazon → eBay US: aynı pazar, çapraz DEĞİL", () => {
    expect(isCrossMarket("US", "EBAY_US")).toBe(false);
  });

  test("UK Amazon → eBay US: farklı ülke, ÇAPRAZ", () => {
    expect(isCrossMarket("UK", "EBAY_US")).toBe(true);
  });

  test("DE Amazon → eBay DE: aynı pazar, çapraz DEĞİL", () => {
    expect(isCrossMarket("DE", "EBAY_DE")).toBe(false);
  });

  test("bilinmeyen/boş değer US varsayılanına düşer", () => {
    expect(isCrossMarket(null, null)).toBe(false);
    expect(isCrossMarket(undefined, "EBAY_GB")).toBe(true);
  });
});

describe("resolveExtraCosts", () => {
  test("ayar yoksa güvenli TR varsayımları kullanılır (intl uygulanır, fx US'te uygulanmaz)", () => {
    const r = resolveExtraCosts(null, "US", "EBAY_US");
    expect(r.extraRate).toBeCloseTo(DEFAULT_EBAY_INTL_FEE_PCT / 100, 5);
    expect(r.extraSourceFixed).toBe(0);
  });

  test("USD-dışı pazarda (UK) kur çevrim ücreti de eklenir", () => {
    const r = resolveExtraCosts(null, "US", "EBAY_GB");
    const expected = (DEFAULT_EBAY_INTL_FEE_PCT + DEFAULT_EBAY_FX_FEE_PCT) / 100;
    expect(r.extraRate).toBeCloseTo(expected, 5);
  });

  test("çapraz pazarda kullanıcı tamponları (yüzde + sabit) eklenir", () => {
    const r = resolveExtraCosts(
      { ebayIntlFeePct: 1.55, ebayFxFeePct: 3, crossExtraPct: 2, crossExtraFixed: 5 },
      "UK",
      "EBAY_US"
    );
    // intl (US hedef → fx yok) + çapraz %2
    expect(r.extraRate).toBeCloseTo((1.55 + 2) / 100, 5);
    expect(r.extraSourceFixed).toBe(5);
  });

  test("aynı pazarda (US→US) çapraz tamponlar UYGULANMAZ, kullanıcı 0 dışı yazsa bile", () => {
    const r = resolveExtraCosts(
      { ebayIntlFeePct: 0, ebayFxFeePct: 0, crossExtraPct: 5, crossExtraFixed: 10 },
      "US",
      "EBAY_US"
    );
    expect(r.extraRate).toBe(0);
    expect(r.extraSourceFixed).toBe(0);
  });

  test("kullanıcı intl/fx oranını 0 yaparsa (ör. ABD kayıtlı satıcı) tamamen kapanır", () => {
    const r = resolveExtraCosts(
      { ebayIntlFeePct: 0, ebayFxFeePct: 0, crossExtraPct: 0, crossExtraFixed: 0 },
      "US",
      "EBAY_GB"
    );
    expect(r.extraRate).toBe(0);
  });

  test("negatif ayar değerleri asla negatif orana dönüşmez (taban 0)", () => {
    const r = resolveExtraCosts(
      { ebayIntlFeePct: -5, ebayFxFeePct: -5, crossExtraPct: -5, crossExtraFixed: -5 },
      "UK",
      "EBAY_GB"
    );
    expect(r.extraRate).toBe(0);
    expect(r.extraSourceFixed).toBe(0);
  });
});
