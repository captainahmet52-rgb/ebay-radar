import { describe, test, expect } from "vitest";
import {
  AMAZON_MARKETS,
  calculateAmazonPrice,
  determineAmazonQty,
  isPriceSpike,
  resolveMargin,
  userMarginForMarket,
  getReferralRate,
} from "@/lib/amazon-repricer";

describe("calculateAmazonPrice — pazar başına KDV/gümrük/kur", () => {
  test("US: KDV yok, hedef marjı birebir tutturur", () => {
    const r = calculateAmazonPrice(10, 3, 0.15, AMAZON_MARKETS.us, 0.2);
    expect(r.salePrice).toBe(20);
    expect(r.netProfit).toBe(4);
    expect(r.marginPct).toBe(20);
    expect(r.vat).toBe(0);
  });

  test("Suudi: KDV %15 + gümrük düşülünce yine %30 marj kalır", () => {
    const r = calculateAmazonPrice(10, 3, 0.15, AMAZON_MARKETS.sa, 0.3);
    // landed = (10+3)*3.75*1.05 = 51.1875
    expect(r.landedCost).toBeCloseTo(51.19, 1);
    expect(r.marginPct).toBeCloseTo(30, 0);
    expect(r.vat).toBeGreaterThan(0);
  });

  test("UK: ücret KDV'si fiyatı yükseltir ama marjı korur", () => {
    const r = calculateAmazonPrice(10, 3, 0.15, AMAZON_MARKETS.uk, 0.25);
    expect(r.marginPct).toBeCloseTo(25, 0);
  });

  test("komisyon + marj toplamı 1'i geçerse hata", () => {
    expect(() => calculateAmazonPrice(10, 0, 0.9, AMAZON_MARKETS.us, 0.2)).toThrow();
  });
});

describe("determineAmazonQty", () => {
  test("in_stock → 2", () => expect(determineAmazonQty("in_stock", null)).toBe(2));
  test("low ≥3 → 1", () => expect(determineAmazonQty("low", 5)).toBe(1));
  test("low <3 → 0", () => expect(determineAmazonQty("low", 2)).toBe(0));
  test("out → 0", () => expect(determineAmazonQty("out", null)).toBe(0));
  test("unknown → 0", () => expect(determineAmazonQty("unknown", 99)).toBe(0));
});

describe("isPriceSpike", () => {
  test("%50'den fazla artış spike", () => expect(isPriceSpike(10, 16)).toBe(true));
  test("%50 altı spike değil", () => expect(isPriceSpike(10, 14)).toBe(false));
  test("eski fiyat 0 ise spike değil", () => expect(isPriceSpike(0, 100)).toBe(false));
});

describe("marj çözümleme", () => {
  test("kullanıcı yüzdesi varsa onu kullanır", () => {
    expect(resolveMargin(AMAZON_MARKETS.us, 35)).toBe(0.35);
  });
  test("yoksa pazar varsayılanı", () => {
    expect(resolveMargin(AMAZON_MARKETS.sa, null)).toBe(0.3);
  });
  test("userMarginForMarket doğru alanı seçer", () => {
    const o = { amazonMarginUsPct: 22, amazonMarginSaPct: 33 };
    expect(userMarginForMarket("us", o)).toBe(22);
    expect(userMarginForMarket("sa", o)).toBe(33);
    expect(userMarginForMarket("uk", o)).toBeNull();
  });
});

describe("getReferralRate", () => {
  test("elektronik %8", () => expect(getReferralRate("electronics")).toBe(0.08));
  test("takı %20", () => expect(getReferralRate("jewelry")).toBe(0.2));
  test("bilinmeyen → varsayılan %15", () => expect(getReferralRate("xyz")).toBe(0.15));
});
