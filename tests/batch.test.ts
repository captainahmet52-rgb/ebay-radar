import { describe, test, expect } from "vitest";
import { chunk, runBatched, DB_CHUNK } from "@/lib/batch";

describe("chunk", () => {
  test("boş dizi → boş sonuç", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  test("size'dan küçük dizi → tek parça (davranış değişmez)", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  test("tam bölünen dizi → eşit parçalar", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  test("artık kalan → son parça kısa", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("100.000 eleman DB_CHUNK ile → 100 parça, hiçbiri sınırı aşmaz", () => {
    const items = Array.from({ length: 100_000 }, (_, i) => i);
    const parts = chunk(items, DB_CHUNK);
    expect(parts.length).toBe(100);
    expect(parts.every((p) => p.length <= DB_CHUNK)).toBe(true);
    expect(parts.flat().length).toBe(100_000);
  });

  test("geçersiz size → hata", () => {
    expect(() => chunk([1], 0)).toThrow();
  });
});

describe("runBatched", () => {
  test("tüm elemanları işler, sonuçlar giriş sırasında", async () => {
    const out = await runBatched([1, 2, 3, 4, 5], 2, async (n) => n * 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  test("eş zamanlılığı size ile sınırlar (aynı anda size'dan fazla çalışmaz)", async () => {
    let active = 0;
    let maxActive = 0;
    await runBatched(Array.from({ length: 20 }), 4, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  test("index doğru geçilir", async () => {
    const out = await runBatched(["a", "b", "c"], 2, async (_, i) => i);
    expect(out).toEqual([0, 1, 2]);
  });

  test("boş dizi → boş sonuç, fn hiç çağrılmaz", async () => {
    let called = false;
    const out = await runBatched([], 3, async () => {
      called = true;
    });
    expect(out).toEqual([]);
    expect(called).toBe(false);
  });
});
