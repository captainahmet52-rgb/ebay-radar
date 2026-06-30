import { describe, test, expect } from "vitest";
import { pickAmazonPrice } from "@/lib/amazon-search-scraper";

describe("pickAmazonPrice — sağlam fiyat ayrıştırma", () => {
  test("base offscreen ($12.99) → 12.99", () => {
    expect(pickAmazonPrice({ priceBase: "$12.99" })).toBe(12.99);
  });

  test("base boş → a-price offscreen fallback", () => {
    expect(pickAmazonPrice({ priceBase: "", priceOff: "$24.50" })).toBe(24.5);
  });

  test("offscreen yok → whole + fraction birleşir (12 + 99)", () => {
    expect(pickAmazonPrice({ priceWhole: "12", priceFraction: "99" })).toBe(12.99);
  });

  test("sadece whole (kuruşsuz) → tam sayı", () => {
    expect(pickAmazonPrice({ priceWhole: "8" })).toBe(8);
  });

  test("binlik ayraçlı fiyat ($1,299.00) → 1299", () => {
    expect(pickAmazonPrice({ priceBase: "$1,299.00" })).toBe(1299);
  });

  test("dizi (string[]) ilk elemanı alınır", () => {
    expect(pickAmazonPrice({ priceBase: ["$15.00", "$99.00"] })).toBe(15);
  });

  test("whole virgüllü ('1,299') + fraction → 1299.00", () => {
    expect(pickAmazonPrice({ priceWhole: "1,299", priceFraction: "00" })).toBe(1299);
  });

  test("base öncelikli: base varsa whole'a düşmez", () => {
    expect(pickAmazonPrice({ priceBase: "$5.00", priceWhole: "999" })).toBe(5);
  });

  test("hiçbir fiyat alanı yok → null", () => {
    expect(pickAmazonPrice({ title: "X" })).toBeNull();
  });

  test("boş/çöp fiyat → null", () => {
    expect(pickAmazonPrice({ priceBase: "", priceOff: "$0.00", priceWhole: "" })).toBeNull();
  });
});
