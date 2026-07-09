import { describe, test, expect } from "vitest";
import { ratingToStars, toCandidate } from "@/lib/amazon-radar-source";
import type { AliDiscoveredProduct } from "@/lib/aliexpress";

describe("ratingToStars", () => {
  test("0-5 puan aynen kullanılır", () => {
    expect(ratingToStars(4.8)).toBe(4.8);
    expect(ratingToStars(5)).toBe(5);
  });

  test("yüzde (>5) 0-5'e ölçeklenir", () => {
    expect(ratingToStars(95)).toBeCloseTo(4.75);
    expect(ratingToStars(100)).toBe(5);
    expect(ratingToStars(80)).toBe(4);
  });

  test("yüzde 100'ü aşarsa 5'e kırpılır", () => {
    expect(ratingToStars(120)).toBe(5);
  });

  test("bilinmiyorsa (null) 4.6 döner — veri yokluğu tek başına elemesin", () => {
    expect(ratingToStars(null)).toBe(4.6);
  });
});

describe("toCandidate", () => {
  const base: AliDiscoveredProduct = {
    aliId: "12345",
    title: "Katlanır Silikon Su Şişesi",
    costUsd: 3.8,
    shippingUsd: 1.5,
    orders: 5600,
    rating: 96,
    category: "sports",
  };

  test("AliExpress alanlarını radar adayına doğru eşler", () => {
    const c = toCandidate(base);
    expect(c.aliId).toBe("12345");
    expect(c.aliCost).toBe(3.8);
    expect(c.aliShipping).toBe(1.5);
    expect(c.aliOrders).toBe(5600);
    expect(c.aliRating).toBeCloseTo(4.8); // 96% → 4.8
    expect(c.category).toBe("sports");
  });

  test("marka daima Generic (keşifte marka gelmez, radar jenerik'i güvenli sayar)", () => {
    expect(toCandidate(base).brand).toBe("Generic");
  });

  test("Amazon tarafı alanları Keepa gelene kadar null/false", () => {
    const c = toCandidate(base);
    expect(c.amazonBsr).toBeNull();
    expect(c.amazonSalesEst).toBeNull();
    expect(c.amazonSellerCount).toBeNull();
    expect(c.amazonSoldByAmazon).toBe(false);
  });
});
