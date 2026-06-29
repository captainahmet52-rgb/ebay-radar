import { describe, test, expect } from "vitest";
import { buildAmazonQueries } from "@/lib/radar/query-builder";
import { wasRecentlySeen, markSeen, type CacheRedis } from "@/lib/radar/item-cache";

describe("buildAmazonQueries", () => {
  test("zengin başlık → tam + marka-model + marka-çekirdek (tekrarsız)", () => {
    const q = buildAmazonQueries("Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black");
    expect(q.length).toBeGreaterThanOrEqual(2);
    expect(q[0]).toContain("Sony"); // tam başlık önce
    expect(q.some((s) => s.includes("WH1000XM4"))).toBe(true); // marka+model
    // tekrar yok
    expect(new Set(q).size).toBe(q.length);
  });

  test("model yok + kısa başlık → tek sorgu (gereksiz arama yok)", () => {
    const q = buildAmazonQueries("Garden Hose");
    expect(q.length).toBe(1);
  });

  test("uzun başlık 14 kelimeye kırpılır", () => {
    const long = Array.from({ length: 25 }, (_, i) => `word${i}`).join(" ");
    const q = buildAmazonQueries(long);
    expect(q[0].split(/\s+/).length).toBeLessThanOrEqual(14);
  });

  test("boş başlık → boş", () => {
    expect(buildAmazonQueries("   ")).toEqual([]);
  });
});

// sahte CacheRedis (get/set, TTL yok say)
function fakeCache(): CacheRedis & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    async set(key, value) {
      store.set(key, value);
      return "OK";
    },
  };
}

describe("item-cache", () => {
  test("markSeen → wasRecentlySeen true", async () => {
    const redis = fakeCache();
    expect(await wasRecentlySeen(redis, "123")).toBe(false);
    await markSeen(redis, "123", "skip");
    expect(await wasRecentlySeen(redis, "123")).toBe(true);
  });

  test("görülmemiş item → false", async () => {
    const redis = fakeCache();
    expect(await wasRecentlySeen(redis, "999")).toBe(false);
  });

  test("redis hatası → wasRecentlySeen false (graceful, değerlendirmeye devam)", async () => {
    const broken: CacheRedis = {
      get: async () => {
        throw new Error("redis down");
      },
      set: async () => "OK",
    };
    expect(await wasRecentlySeen(broken, "123")).toBe(false);
  });
});
