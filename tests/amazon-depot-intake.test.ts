import { describe, it, expect } from "vitest";
import { partitionIntakeItems } from "@/lib/amazon-depot-intake";

function item(aliId: string, overrides: Record<string, unknown> = {}) {
  return {
    aliId,
    title: `Ürün ${aliId}`,
    aliCostUsd: 3.5,
    aliShippingUsd: 0,
    aliOrders: 120,
    aliRating: 4.6,
    radarScore: 72,
    sourceChannel: "amazon",
    ...overrides,
  };
}

describe("partitionIntakeItems", () => {
  it("tek bozuk ürün partinin geri kalanını reddettirmez", () => {
    const { valid, rejected } = partitionIntakeItems([
      item("1"),
      item("2", { aliCostUsd: 0 }), // pozitif değil → geçersiz
      item("3"),
    ]);
    expect(valid.map((v) => v.aliId)).toEqual(["1", "3"]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].aliId).toBe("2");
    expect(rejected[0].reason).toContain("aliCostUsd");
  });

  it("aliId'si olmayan veya obje olmayan girdiyi aliId=null ile raporlar", () => {
    const { valid, rejected } = partitionIntakeItems([null, "x", { title: "isimsiz" }]);
    expect(valid).toEqual([]);
    expect(rejected.map((r) => r.aliId)).toEqual([null, null, null]);
  });

  it("aynı aliId iki kez gelirse tek kayıt kalır (sonuncusu)", () => {
    const { valid } = partitionIntakeItems([item("7", { radarScore: 50 }), item("7", { radarScore: 90 })]);
    expect(valid).toHaveLength(1);
    expect(valid[0].radarScore).toBe(90);
  });

  it("shopify kanalını kabul eder, bilinmeyen kanalı reddeder", () => {
    const { valid, rejected } = partitionIntakeItems([
      item("s1", { sourceChannel: "shopify" }),
      item("x1", { sourceChannel: "walmart" }),
    ]);
    expect(valid.map((v) => v.aliId)).toEqual(["s1"]);
    expect(rejected[0].aliId).toBe("x1");
  });
});
