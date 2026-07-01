import { describe, test, expect } from "vitest";
import { parseSoldQuantity } from "@/lib/ebay/seller-listings";

describe("parseSoldQuantity — getItem satış adedi", () => {
  test("estimatedSoldQuantity döndürür", () => {
    const item = {
      estimatedAvailabilities: [
        { estimatedAvailabilityStatus: "IN_STOCK", estimatedSoldQuantity: 362 },
      ],
    };
    expect(parseSoldQuantity(item)).toBe(362);
  });

  test("satış adedi yoksa null", () => {
    expect(parseSoldQuantity({ estimatedAvailabilities: [{}] })).toBeNull();
  });

  test("estimatedAvailabilities yoksa null", () => {
    expect(parseSoldQuantity({})).toBeNull();
  });

  test("boş dizi → null", () => {
    expect(parseSoldQuantity({ estimatedAvailabilities: [] })).toBeNull();
  });

  test("sıfır satış → 0 (null değil)", () => {
    expect(parseSoldQuantity({ estimatedAvailabilities: [{ estimatedSoldQuantity: 0 }] })).toBe(0);
  });
});
