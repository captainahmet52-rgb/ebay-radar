import { describe, test, expect } from "vitest";
import {
  median,
  mad,
  computeBandFromLogRatios,
  recordSellerRatio,
  getSellerPriceBand,
  MIN_SAMPLES,
  type RadarRedis,
} from "@/lib/radar/seller-profile";
import { GLOBAL_PRECISION_BAND, PRICE_ABS_MAX } from "@/lib/radar/source-matcher";
import { recordRadarDecision, readRecentDecisions, type RadarAuditEntry } from "@/lib/radar/audit";

// ── basit in-memory Redis sahtesi (lpush/ltrim/lrange) ──
function fakeRedis(): RadarRedis & { store: Map<string, string[]> } {
  const store = new Map<string, string[]>();
  return {
    store,
    async lpush(key, value) {
      const list = store.get(key) ?? [];
      list.unshift(value); // LPUSH başa ekler
      store.set(key, list);
      return list.length;
    },
    async ltrim(key, start, stop) {
      const list = store.get(key) ?? [];
      store.set(key, list.slice(start, stop + 1));
      return "OK";
    },
    async lrange(key, start, stop) {
      const list = store.get(key) ?? [];
      const end = stop === -1 ? list.length : stop + 1;
      return list.slice(start, end);
    },
  };
}

describe("median / mad", () => {
  test("median tek/çift", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  test("mad", () => {
    expect(mad([1, 1, 1])).toBe(0);
    expect(mad([1, 2, 3, 4, 5])).toBe(1); // medyan 3, sapmalar |.-3|=2,1,0,1,2 → medyan 1
  });
});

describe("computeBandFromLogRatios", () => {
  test("örnek azsa fallback döner", () => {
    const few = Array.from({ length: MIN_SAMPLES - 1 }, () => Math.log(0.6));
    expect(computeBandFromLogRatios(few, GLOBAL_PRECISION_BAND)).toEqual(GLOBAL_PRECISION_BAND);
  });

  test("tutarlı satıcı (~0.6 oran) → bandı global içinde daraltır", () => {
    const logs = Array.from({ length: 30 }, () => Math.log(0.6 + (Math.random() - 0.5) * 0.02));
    const band = computeBandFromLogRatios(logs, GLOBAL_PRECISION_BAND);
    expect(band.min).toBeGreaterThanOrEqual(GLOBAL_PRECISION_BAND.min);
    expect(band.max).toBeLessThanOrEqual(GLOBAL_PRECISION_BAND.max);
    expect(band.min).toBeLessThan(0.6);
    expect(band.max).toBeGreaterThan(0.6);
  });

  test("öğrenilen bant ASLA global mutlak bandı (0.95) aşmaz", () => {
    const logs = Array.from({ length: 30 }, () => Math.log(0.9));
    const band = computeBandFromLogRatios(logs, GLOBAL_PRECISION_BAND);
    expect(band.max).toBeLessThanOrEqual(PRICE_ABS_MAX);
    expect(band.max).toBeLessThanOrEqual(GLOBAL_PRECISION_BAND.max);
  });
});

describe("recordSellerRatio + getSellerPriceBand (Redis I/O)", () => {
  test("yeterli kabulden sonra satıcı bandı öğrenilir", async () => {
    const redis = fakeRedis();
    for (let i = 0; i < 20; i++) await recordSellerRatio(redis, "store1", 0.6);
    const band = await getSellerPriceBand(redis, "store1", GLOBAL_PRECISION_BAND);
    // 0.6 etrafında dar bir bant
    expect(band.min).toBeGreaterThanOrEqual(GLOBAL_PRECISION_BAND.min);
    expect(band.max).toBeLessThanOrEqual(GLOBAL_PRECISION_BAND.max);
  });

  test("mantıksız oran (bant dışı) profile yazılmaz", async () => {
    const redis = fakeRedis();
    await recordSellerRatio(redis, "store2", 5.0); // 0.95 üstü
    await recordSellerRatio(redis, "store2", 0.05); // 0.25 altı
    expect(redis.store.get("radar:seller:store2:logratios") ?? []).toHaveLength(0);
  });

  test("veri yoksa fallback", async () => {
    const redis = fakeRedis();
    const band = await getSellerPriceBand(redis, "empty", GLOBAL_PRECISION_BAND);
    expect(band).toEqual(GLOBAL_PRECISION_BAND);
  });
});

describe("audit", () => {
  test("karar kaydı yazılır ve okunur (en yeni önce)", async () => {
    const redis = fakeRedis();
    const mk = (asin: string, decision: RadarAuditEntry["decision"]): RadarAuditEntry => ({
      ts: Date.now(),
      storeId: "s1",
      ebayTitle: "X",
      ebayPrice: 30,
      decision,
      asin,
      contract: decision === "accept" ? "B" : null,
      confidence: 0.8,
      reason: "test",
      priceRatio: 0.6,
      candidateCount: 5,
    });
    await recordRadarDecision(redis, mk("B001", "skip"));
    await recordRadarDecision(redis, mk("B002", "accept"));
    const recent = await readRecentDecisions(redis, 10);
    expect(recent).toHaveLength(2);
    expect(recent[0].asin).toBe("B002"); // en yeni önce
    expect(recent[0].decision).toBe("accept");
  });
});
