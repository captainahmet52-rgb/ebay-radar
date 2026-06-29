import { describe, test, expect } from "vitest";
import { parseFindingItems } from "@/lib/ebay/seller-listings";

describe("parseFindingItems", () => {
  test("Finding API item'larını sadeleştirir", () => {
    const raw = [
      {
        itemId: ["110512345678"],
        title: ["Milwaukee M18 FUEL Impact Wrench"],
        galleryURL: ["https://i.ebayimg.com/abc.jpg"],
        sellingStatus: [{ currentPrice: [{ __value__: "129.99" }] }],
      },
      {
        itemId: ["220598765432"],
        title: ["DeWalt 20V Battery"],
        galleryURL: ["https://i.ebayimg.com/def.jpg"],
        sellingStatus: [{ currentPrice: [{ __value__: "89.50" }] }],
      },
    ];
    const out = parseFindingItems(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: "Milwaukee M18 FUEL Impact Wrench",
      price: 129.99,
      itemId: "110512345678",
      imageUrl: "https://i.ebayimg.com/abc.jpg",
      soldCount: null, // API sold vermiyor
    });
    expect(out[1].price).toBe(89.5);
  });

  test("eksik alanlar → graceful null", () => {
    const out = parseFindingItems([{ title: ["X"] }]);
    expect(out[0].price).toBeNull();
    expect(out[0].itemId).toBeNull();
    expect(out[0].imageUrl).toBeNull();
  });

  test("geçersiz görsel URL → null", () => {
    const out = parseFindingItems([{ title: ["X"], galleryURL: ["not-a-url"] }]);
    expect(out[0].imageUrl).toBeNull();
  });

  test("boş liste → boş", () => {
    expect(parseFindingItems([])).toEqual([]);
  });
});
