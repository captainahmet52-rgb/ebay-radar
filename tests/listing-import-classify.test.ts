import { describe, test, expect } from "vitest";
import { classifyDiscovered } from "@/lib/ebay/listing-import";
import type { ParsedEbayListing } from "@/lib/ebay/trading-parser";

const listing = (over: Partial<ParsedEbayListing>): ParsedEbayListing => ({
  ebayItemId: "110012345678",
  ebaySku: null,
  title: "Some Title",
  price: 29.99,
  currency: "USD",
  quantityAvailable: 3,
  imageUrl: null,
  site: "US",
  ...over,
});

describe("classifyDiscovered — keşif fazı (ağsız, scraper'sız)", () => {
  test("SKU'da ASIN var → pending (Amazon doğrulaması bekler)", () => {
    const r = classifyDiscovered(listing({ ebaySku: "AZ-B08N5WRWNW-2" }));
    expect(r.detectedAsin).toBe("B08N5WRWNW");
    expect(r.matchStatus).toBe("pending");
  });

  test("SKU'da ASIN yok → unmatched (Amazon'a HİÇ bakmaz, maliyet yok)", () => {
    const r = classifyDiscovered(listing({ ebaySku: "MY-CUSTOM-SKU-42" }));
    expect(r.detectedAsin).toBeNull();
    expect(r.matchStatus).toBe("unmatched");
  });

  test("SKU yok (null) → unmatched", () => {
    const r = classifyDiscovered(listing({ ebaySku: null }));
    expect(r.detectedAsin).toBeNull();
    expect(r.matchStatus).toBe("unmatched");
  });

  test("düz ASIN SKU → pending", () => {
    const r = classifyDiscovered(listing({ ebaySku: "B07XJ8C8F5" }));
    expect(r.detectedAsin).toBe("B07XJ8C8F5");
    expect(r.matchStatus).toBe("pending");
  });
});
