import { describe, test, expect } from "vitest";
import { parseBrowseItems, extractLegacyItemId } from "@/lib/ebay/seller-listings";

describe("parseBrowseItems", () => {
  test("Browse item_summary'lerini sadeleştirir", () => {
    const raw = [
      {
        itemId: "v1|110512345678|0",
        title: "Milwaukee M18 FUEL Impact Wrench",
        price: { value: "129.99" },
        image: { imageUrl: "https://i.ebayimg.com/abc.jpg" },
      },
      {
        itemId: "v1|220598765432|0",
        title: "DeWalt 20V Battery",
        price: { value: "89.50" },
        thumbnailImages: [{ imageUrl: "https://i.ebayimg.com/def.jpg" }],
      },
    ];
    const out = parseBrowseItems(raw);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      title: "Milwaukee M18 FUEL Impact Wrench",
      price: 129.99,
      itemId: "v1|110512345678|0",
      imageUrl: "https://i.ebayimg.com/abc.jpg",
      soldCount: null, // Browse sold vermiyor
    });
    expect(out[1].price).toBe(89.5);
    expect(out[1].imageUrl).toBe("https://i.ebayimg.com/def.jpg"); // thumbnail fallback
  });

  test("eksik alanlar → graceful null", () => {
    const out = parseBrowseItems([{ title: "X" }]);
    expect(out[0].price).toBeNull();
    expect(out[0].itemId).toBeNull();
    expect(out[0].imageUrl).toBeNull();
  });

  test("geçersiz fiyat → null", () => {
    const out = parseBrowseItems([{ title: "X", price: { value: "abc" } }]);
    expect(out[0].price).toBeNull();
  });

  test("boş liste → boş", () => {
    expect(parseBrowseItems([])).toEqual([]);
  });
});

describe("extractLegacyItemId", () => {
  test("standart ürün linkinden id çıkarır", () => {
    expect(extractLegacyItemId("https://www.ebay.com/itm/365979402122")).toBe("365979402122");
  });

  test("başlık-slug'lı ürün linkinden id çıkarır", () => {
    expect(
      extractLegacyItemId("https://www.ebay.com/itm/Large-Eye-Needles/365979402122?hash=abc"),
    ).toBe("365979402122");
  });

  test("düz id metninden çıkarır", () => {
    expect(extractLegacyItemId("365979402122")).toBe("365979402122");
  });

  test("kullanıcı adı (rakamsız) → null", () => {
    expect(extractLegacyItemId("md.asifpa-0")).toBeNull();
  });

  test("kısa rakam dizisi → null", () => {
    expect(extractLegacyItemId("abc123")).toBeNull();
  });
});
