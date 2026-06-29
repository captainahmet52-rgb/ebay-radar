import { describe, test, expect } from "vitest";
import { assessViability } from "@/lib/radar/viability";
import { parseSoldCount } from "@/lib/ebay-store-scraper";

describe("parseSoldCount", () => {
  test("çeşitli formatlar", () => {
    expect(parseSoldCount("1,234 sold")).toBe(1234);
    expect(parseSoldCount("56 sold")).toBe(56);
    expect(parseSoldCount("1.2K sold")).toBe(1200);
    expect(parseSoldCount("Brand New")).toBeNull();
    expect(parseSoldCount(undefined)).toBeNull();
    expect(parseSoldCount("")).toBeNull();
  });
});

describe("assessViability — para motoru", () => {
  test("Amazon fiyatı yok → talep ile sırala, viable", () => {
    const v = assessViability({ amazonPrice: null, competitorPrice: 50, soldCount: 100 });
    expect(v.viable).toBe(true);
    expect(v.projectedEbayPrice).toBeNull();
    expect(v.rankScore).toBeGreaterThan(0); // log1p(100) > 0
  });

  test("kârlı + rekabetçi (rakip pahalı) → viable, skor > 0", () => {
    const v = assessViability({ amazonPrice: 100, competitorPrice: 300, soldCount: 0 });
    expect(v.viable).toBe(true);
    expect(v.projectedEbayPrice).toBeGreaterThan(100);
    expect(v.projectedProfit).toBeGreaterThan(0);
    expect(v.competitiveness).toBeGreaterThan(1); // rakip bizden pahalı
    expect(v.rankScore).toBeGreaterThan(0);
  });

  test("rakipten aşırı pahalı (satmaz) → viable=false, skor 0", () => {
    const v = assessViability({ amazonPrice: 100, competitorPrice: 40, soldCount: 50 });
    expect(v.viable).toBe(false);
    expect(v.rankScore).toBe(0);
    expect(v.reason).toContain("pahalı");
  });

  test("satış sinyali skoru yükseltir (aynı ürün, daha çok sold → daha yüksek skor)", () => {
    const base = { amazonPrice: 100, competitorPrice: 300 };
    const noSold = assessViability({ ...base, soldCount: 0 });
    const hotSold = assessViability({ ...base, soldCount: 500 });
    expect(hotSold.rankScore).toBeGreaterThan(noSold.rankScore);
  });

  test("rakip fiyatı yok → competitiveness null, viable (kâr ile sırala)", () => {
    const v = assessViability({ amazonPrice: 100, competitorPrice: null, soldCount: 0 });
    expect(v.competitiveness).toBeNull();
    expect(v.viable).toBe(true);
    expect(v.rankScore).toBeGreaterThan(0);
  });
});
