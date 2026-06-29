import { describe, test, expect } from "vitest";
import { revalidateListingTitle } from "@/lib/radar/revalidate";

describe("revalidateListingTitle — ilk yayın kapısı", () => {
  test("tutarlı başlık → ok", () => {
    const r = revalidateListingTitle(
      "Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black",
      "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
    );
    expect(r.ok).toBe(true);
  });

  test("model kodu değişmiş (XM4 → XM3) → ENGELLE (recycled ASIN)", () => {
    const r = revalidateListingTitle(
      "Sony WH-1000XM4 Wireless Headphones",
      "Sony WH-1000XM3 Wireless Headphones",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("model");
  });

  test("paket adedi değişmiş (4 → 24) → ENGELLE", () => {
    const r = revalidateListingTitle(
      "AAA Batteries 4 Pack Alkaline",
      "AAA Batteries 24 Pack Alkaline",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("paket");
  });

  test("tamamen farklı ürün (düşük benzerlik) → ENGELLE", () => {
    const r = revalidateListingTitle(
      "Stainless Steel Water Bottle Wide Mouth Insulated",
      "Cotton Bath Towel Set Soft Absorbent Bathroom",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("tutarsız");
  });

  test("canlı başlık yok → doğrulama atlanır (engelleme yok)", () => {
    expect(revalidateListingTitle("Sony WH-1000XM4 Headphones", null).ok).toBe(true);
    expect(revalidateListingTitle("Sony WH-1000XM4 Headphones", "").ok).toBe(true);
  });

  test("baseline başlık yok → doğrulama atlanır", () => {
    expect(revalidateListingTitle(null, "Sony WH-1000XM4 Headphones").ok).toBe(true);
  });
});
