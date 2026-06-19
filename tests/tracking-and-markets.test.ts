import { describe, test, expect } from "vitest";
import { TRACKING_CONVERSION_FEE_USD } from "@/lib/tracking";
import {
  resolveEbayMarketplace,
  normalizeEbayMarketplaceId,
  EBAY_MARKETPLACES,
} from "@/lib/ebay-markets";

describe("takip çevirme ücreti", () => {
  test("çevirme başına ücret $0.43 (10 TL)", () => {
    expect(TRACKING_CONVERSION_FEE_USD).toBe(0.43);
  });
});

describe("eBay pazar çözümleme", () => {
  test("bilinen site doğru pazarı döner", () => {
    expect(resolveEbayMarketplace("EBAY_GB").currency).toBe("GBP");
    expect(resolveEbayMarketplace("EBAY_US").currency).toBe("USD");
  });
  test("bilinmeyen site US'e düşer", () => {
    expect(resolveEbayMarketplace("EBAY_XX").key).toBe("EBAY_US");
    expect(resolveEbayMarketplace(null).key).toBe("EBAY_US");
  });
  test("UK ücretine KDV biner (feeVatRate %20)", () => {
    expect(EBAY_MARKETPLACES.EBAY_GB.feeVatRate).toBe(0.2);
  });
  test("registrationMarketplaceId normalize edilir", () => {
    expect(normalizeEbayMarketplaceId("EBAY_DE")).toBe("EBAY_DE");
    expect(normalizeEbayMarketplaceId("EBAY_ZZ")).toBe("EBAY_US");
    expect(normalizeEbayMarketplaceId(undefined)).toBe("EBAY_US");
  });
});
