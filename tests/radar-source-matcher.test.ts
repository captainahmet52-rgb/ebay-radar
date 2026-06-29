import { describe, test, expect } from "vitest";
import {
  selectRadarMatch,
  type RadarCandidate,
} from "@/lib/radar/source-matcher";
import {
  splitCompat,
  compareProductType,
  extractTypeGroups,
} from "@/lib/radar/product-type";
import { attributeConflict, extractAttributes } from "@/lib/radar/attributes";

const cand = (over: Partial<RadarCandidate> & Pick<RadarCandidate, "asin">): RadarCandidate => ({
  title: "",
  price: null,
  ...over,
});

// ─── product-type ────────────────────────────────────────────────────────────
describe("splitCompat — uyumluluk bağlamını ayırır", () => {
  test("'for' sonrası uyumluluk bağlamıdır", () => {
    const { core, compat } = splitCompat("Charger for Milwaukee M18 Battery");
    expect(core.toLowerCase()).toBe("charger");
    expect(compat.toLowerCase()).toContain("milwaukee");
  });
  test("uyumluluk işareti yoksa core = tüm başlık", () => {
    expect(splitCompat("Milwaukee Impact Wrench").compat).toBe("");
  });
});

describe("compareProductType", () => {
  test("aynı tip → agree", () => {
    expect(compareProductType("Impact Wrench", "Heavy Duty Wrench")).toBe("agree");
  });
  test("farklı tip → conflict (wrench ≠ battery)", () => {
    expect(compareProductType("Impact Wrench", "M18 Battery 5Ah")).toBe("conflict");
  });
  test("bir tarafta tip yok → unknown (veto yok)", () => {
    expect(compareProductType("Random Gizmo XYZ", "Impact Wrench")).toBe("unknown");
  });
  test("'Charger for Drill' → drill DEĞİL charger sayılır", () => {
    expect(extractTypeGroups(splitCompat("Charger for Cordless Drill").core).size).toBeGreaterThan(0);
    expect(compareProductType("Charger for Cordless Drill", "Cordless Drill 20V")).toBe("conflict");
  });
});

// ─── attributes ──────────────────────────────────────────────────────────────
describe("attributeConflict — negatif token vetosu", () => {
  test("12V vs 20V → çelişki", () => {
    expect(attributeConflict("DeWalt 20V Battery", "DeWalt 12V Battery")).toBe("voltaj");
  });
  test("50ft vs 100ft → çelişki", () => {
    expect(attributeConflict("Garden Hose 50ft", "Garden Hose 100ft")).toContain("uzunluk");
  });
  test("aynı voltaj → çelişki yok", () => {
    expect(attributeConflict("DeWalt 20V Battery", "DeWalt 20V MAX Battery")).toBeNull();
  });
  test("tek tarafta nitelik → çelişki yok", () => {
    expect(attributeConflict("DeWalt 20V Battery", "DeWalt MAX Battery")).toBeNull();
  });
  test("hacim birim çevrimi (1L ≈ 1000ml) → çelişki yok", () => {
    expect(attributeConflict("Water Bottle 1L", "Water Bottle 1000ml")).toBeNull();
  });
});

// ─── selectRadarMatch: KABUL yolları ─────────────────────────────────────────
describe("selectRadarMatch — kabul (accept)", () => {
  test("ortak model + tip + fiyat → accept (Sözleşme B)", () => {
    const r = selectRadarMatch(
      { title: "Sony WH-1000XM4 Wireless Headphones", price: 300 },
      [cand({ asin: "B08AAA1111", title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black", price: 200 })],
    );
    expect(r.decision).toBe("accept");
    expect(r.asin).toBe("B08AAA1111");
    expect(["B", "D"]).toContain(r.contract);
  });

  test("güçlü başlık (model yok) + fiyat → accept (Sözleşme D)", () => {
    const r = selectRadarMatch(
      { title: "Stainless Steel Insulated Water Bottle 32oz Wide Mouth", price: 30 },
      [cand({ asin: "B08DDD2222", title: "Stainless Steel Insulated Water Bottle 32oz Wide Mouth Leakproof", price: 18 })],
    );
    expect(r.decision).toBe("accept");
    expect(r.asin).toBe("B08DDD2222");
  });
});

// ─── selectRadarMatch: ATLA (skip) yolları — yanlış eşleşme önleme ────────────
describe("selectRadarMatch — atla (skip), yanlış eşleşmeyi keser", () => {
  test("ürün tipi çelişkisi (wrench ≠ battery) → skip", () => {
    const r = selectRadarMatch(
      { title: "Milwaukee M18 FUEL Impact Wrench", price: 250 },
      [cand({ asin: "B08BAT0001", title: "Milwaukee M18 REDLITHIUM Battery 5.0Ah", price: 120 })],
    );
    expect(r.decision).toBe("skip");
    expect(r.asin).toBeNull();
  });

  test("fiyat bandı dışı (Amazon eBay'den pahalı) → skip", () => {
    const r = selectRadarMatch(
      { title: "Garden Hose 50ft Heavy Duty Expandable", price: 30 },
      [cand({ asin: "B08HOSE001", title: "Garden Hose 50ft Heavy Duty Expandable Kink Free", price: 85 })],
    );
    expect(r.decision).toBe("skip");
  });

  test("kaynak başlık çok zayıf (tek kelime) → skip", () => {
    const r = selectRadarMatch(
      { title: "Wrench", price: 50 },
      [cand({ asin: "B08WR0001", title: "Milwaukee M18 Impact Wrench", price: 30 })],
    );
    expect(r.decision).toBe("skip");
    expect(r.reason).toContain("zayıf");
  });

  test("negatif token: 20V vs 12V → skip", () => {
    const r = selectRadarMatch(
      { title: "DeWalt 20V MAX Battery 5.0Ah Lithium", price: 100 },
      [cand({ asin: "B0812V001", title: "DeWalt 12V MAX Battery 2.0Ah Lithium", price: 50 })],
    );
    expect(r.decision).toBe("skip");
  });

  test("uyumluluk markası: 'Charger for DeWalt Battery' ≠ DeWalt Battery → skip", () => {
    const r = selectRadarMatch(
      { title: "Fast Charger for DeWalt 20V Battery Lithium", price: 40 },
      [cand({ asin: "B08BATX01", title: "DeWalt 20V MAX Battery 5.0Ah Lithium Ion", price: 60 })],
    );
    expect(r.decision).toBe("skip");
  });

  test("aday yok → skip", () => {
    const r = selectRadarMatch({ title: "Milwaukee Impact Wrench M18", price: 200 }, []);
    expect(r.decision).toBe("skip");
  });
});

// ─── selectRadarMatch: belirsizlik → review (insan) ──────────────────────────
describe("selectRadarMatch — belirsizlik (review)", () => {
  test("iki yakın varyant (siyah/gümüş) → review, accept değil", () => {
    const r = selectRadarMatch(
      { title: "Sony WH-1000XM4 Wireless Headphones", price: 300 },
      [
        cand({ asin: "B08COLOR01", title: "Sony WH-1000XM4 Wireless Headphones Black", price: 200 }),
        cand({ asin: "B08COLOR02", title: "Sony WH-1000XM4 Wireless Headphones Silver", price: 205 }),
      ],
    );
    expect(r.decision).toBe("review");
    expect(r.asin).not.toBeNull();
  });
});

// ─── Tek kazanan garantisi ───────────────────────────────────────────────────
describe("selectRadarMatch — her zaman EN FAZLA tek ASIN", () => {
  test("birçok aday verilse bile tek asin döner", () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      cand({ asin: `B08X${i}00000`, title: "Stainless Steel Water Bottle 32oz Wide Mouth Insulated", price: 18 + i }),
    );
    const r = selectRadarMatch(
      { title: "Stainless Steel Water Bottle 32oz Wide Mouth Insulated", price: 30 },
      candidates,
    );
    // tek string ya da null — asla dizi/çoklu
    expect(typeof r.asin === "string" || r.asin === null).toBe(true);
    expect(r.evals.length).toBe(8); // tüm adaylar denetim için değerlendirildi
  });
});

// ─── Birim: extractAttributes ────────────────────────────────────────────────
describe("extractAttributes", () => {
  test("voltaj/uzunluk/güç okur", () => {
    const a = extractAttributes("DeWalt 20V 1500W Generator 50ft Cable");
    expect(a.voltage).toBe(20);
    expect(a.wattage).toBe(1500);
    expect(a.lengthFt).toBe(50);
  });
});
