import { describe, test, expect } from "vitest";
import {
  buildRadarConfig,
  evaluateCandidate,
  checkBrandSafe,
  checkAllowed,
  type AmazonCandidate,
} from "@/lib/amazon-radar";

function baseCandidate(over: Partial<AmazonCandidate> = {}): AmazonCandidate {
  return {
    aliId: "t1", title: "Jenerik Mutfak Blender", aliCost: 9, aliShipping: 1,
    aliOrders: 4000, aliRating: 4.8, brand: "Generic", category: "kitchen",
    amazonBsr: 8000, amazonSalesEst: 300, amazonSellerCount: 5, amazonSoldByAmazon: false,
    ...over,
  };
}

describe("marka/yasak SERT filtre", () => {
  test("markalı ürün elenir (Nike)", () => {
    const res = checkBrandSafe(baseCandidate({ brand: "Nike", title: "Nike Çorap" }));
    expect(res.safe).toBe(false);
  });
  test("jenerik ürün güvenli", () => {
    expect(checkBrandSafe(baseCandidate()).safe).toBe(true);
  });
  test("yasaklı ibare elenir (replica)", () => {
    expect(checkAllowed(baseCandidate({ title: "Replica AirPods" })).allowed).toBe(false);
  });
});

describe("evaluateCandidate", () => {
  test("uygun jenerik ürün geçer ve fiyatlanır", () => {
    const v = evaluateCandidate(baseCandidate(), buildRadarConfig("us"));
    expect(v.pass).toBe(true);
    expect(v.score).toBeGreaterThan(0);
    expect(v.pricing?.salePrice).toBeGreaterThan(0);
  });

  test("markalı ürün geçemez", () => {
    const v = evaluateCandidate(baseCandidate({ brand: "Apple", title: "Apple Kılıf" }), buildRadarConfig("us"));
    expect(v.pass).toBe(false);
  });

  test("Amazon'un kendisi satıyorsa elenir", () => {
    const v = evaluateCandidate(baseCandidate({ amazonSoldByAmazon: true }), buildRadarConfig("us"));
    expect(v.pass).toBe(false);
  });
});

describe("buildRadarConfig — pazar başına marj", () => {
  test("Suudi varsayılan marjı %30", () => {
    expect(buildRadarConfig("sa").targetMargin).toBe(0.3);
  });
  test("US varsayılan marjı %20", () => {
    expect(buildRadarConfig("us").targetMargin).toBe(0.2);
  });
  test("kullanıcı override edebilir", () => {
    expect(buildRadarConfig("us", { userMarginPct: 40 }).targetMargin).toBe(0.4);
  });
});
