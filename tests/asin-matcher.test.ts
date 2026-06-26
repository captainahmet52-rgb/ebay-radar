import { describe, test, expect } from "vitest";
import {
  extractAsinFromSku,
  titleSimilarity,
  decideMatch,
  extractModelTokens,
  extractPackCount,
  type AmazonCandidate,
} from "@/lib/ebay/asin-matcher";

describe("extractAsinFromSku", () => {
  test("düz ASIN SKU", () => {
    expect(extractAsinFromSku("B08N5WRWNW")).toBe("B08N5WRWNW");
  });
  test("ön ek/son ekli SKU içinden ASIN ayıklar", () => {
    expect(extractAsinFromSku("AZ-B08N5WRWNW-2X")).toBe("B08N5WRWNW");
    expect(extractAsinFromSku("amz_b07xj8c8f5_us")).toBe("B07XJ8C8F5");
  });
  test("ASIN içermeyen SKU → null (tahmin yok)", () => {
    expect(extractAsinFromSku("MY-SKU-12345")).toBeNull();
    expect(extractAsinFromSku("RED-SHIRT-L")).toBeNull();
  });
  test("boş/null → null", () => {
    expect(extractAsinFromSku("")).toBeNull();
    expect(extractAsinFromSku(null)).toBeNull();
    expect(extractAsinFromSku(undefined)).toBeNull();
  });
});

describe("titleSimilarity", () => {
  test("aynı başlık → 1", () => {
    expect(titleSimilarity("Wireless Bluetooth Headphones", "Wireless Bluetooth Headphones")).toBe(1);
  });
  test("alakasız başlıklar → düşük", () => {
    expect(titleSimilarity("Garden Hose 50ft", "Wireless Bluetooth Headphones")).toBeLessThan(0.3);
  });
  test("eBay başlığı Amazon'unkinin alt kümesi → yüksek", () => {
    const ebay = "Sony WH-1000XM4 Wireless Headphones";
    const amazon = "Sony WH-1000XM4 Wireless Noise Cancelling Over-Ear Headphones Black";
    expect(titleSimilarity(ebay, amazon)).toBeGreaterThanOrEqual(0.6);
  });
});

const amazon = (over: Partial<AmazonCandidate>): AmazonCandidate => ({
  asin: "B08N5WRWNW",
  title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black",
  price: 280,
  ...over,
});

describe("decideMatch — SIFIR HATA kuralı", () => {
  test("SKU'da ASIN yoksa → unmatched (asla tahmin etme)", () => {
    const r = decideMatch({ sku: "RANDOM-SKU", ebayTitle: "Sony Headphones", ebayPrice: 300 }, amazon({}));
    expect(r.status).toBe("unmatched");
    expect(r.asin).toBeNull();
  });

  test("ASIN + başlık eşleşir + fiyat makul → confirmed", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony WH-1000XM4 Wireless Headphones", ebayPrice: 320 },
      amazon({ price: 280 })
    );
    expect(r.status).toBe("confirmed");
    expect(r.asin).toBe("B08N5WRWNW");
  });

  test("ASIN var ama başlık alakasız → review (otomatik DOKUNMAZ)", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Garden Hose 50ft Heavy Duty", ebayPrice: 30 },
      amazon({})
    );
    expect(r.status).toBe("review");
  });

  test("ASIN + başlık eşleşir ama Amazon fiyatı çok yüksek → review", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony WH-1000XM4 Wireless Headphones", ebayPrice: 30 },
      amazon({ price: 280 }) // 280 > 30*5 = 150 → şüpheli
    );
    expect(r.status).toBe("review");
  });

  test("ASIN var ama Amazon çekilemedi → review (doğrulanamadı)", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony WH-1000XM4 Wireless Headphones", ebayPrice: 300 },
      null
    );
    expect(r.status).toBe("review");
  });
});

describe("ÇELİŞKİ KAPILARI — model + paket (geri dönüştürülmüş ASIN koruması)", () => {
  test("model kodu çelişir (XM3 vs XM4) → review, asla confirm değil", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony WH-1000XM3 Wireless Headphones", ebayPrice: 300 },
      amazon({ title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones", price: 280 })
    );
    expect(r.status).toBe("review");
    expect(r.reason).toContain("Model");
  });

  test("paket adedi çelişir (1'li vs 4'lü) → review", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "AAA Batteries 4 Pack Alkaline", ebayPrice: 8 },
      amazon({ title: "AAA Batteries 24 Pack Alkaline", price: 12 })
    );
    expect(r.status).toBe("review");
    expect(r.reason).toContain("Paket");
  });

  test("model kodu sadece BİR tarafta → veto YOK (title benzerliğine güven)", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony Wireless Noise Cancelling Headphones Black", ebayPrice: 300 },
      amazon({ title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black", price: 280 })
    );
    expect(r.status).toBe("confirmed"); // model eksik ama çatışma yok + başlık örtüşüyor
  });

  test("ortak model kodu → confirmed", () => {
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Sony WH-1000XM4 Headphones", ebayPrice: 300 },
      amazon({ title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones", price: 280 })
    );
    expect(r.status).toBe("confirmed");
  });

  test("aşırı genel/tek-kelime başlık (sim 1.0 olsa bile) → review (zayıf kanıt)", () => {
    // eBay başlığı tek anlamlı kelime: "Headphones" → tek ortak kelime → confirm YOK
    const r = decideMatch(
      { sku: "B08N5WRWNW", ebayTitle: "Headphones", ebayPrice: 300 },
      amazon({ title: "Sony WH-1000XM4 Wireless Headphones Black", price: 280 })
    );
    expect(r.status).toBe("review");
    expect(r.reason).toContain("kısa");
  });
});

describe("extractModelTokens", () => {
  test("harf+rakam dizilerini çıkarır, saf sayı/harfi eler", () => {
    const t = extractModelTokens("Sony WH-1000XM4 for iPhone 13 14 Black");
    expect(t.has("WH1000XM4")).toBe(true);
    expect(t.has("13")).toBe(false); // saf sayı elenmeli
    expect(t.has("BLACK")).toBe(false); // saf harf elenmeli
  });
});

describe("extractPackCount", () => {
  test("çeşitli paket ifadelerini okur", () => {
    expect(extractPackCount("AAA Batteries 4 Pack")).toBe(4);
    expect(extractPackCount("Socks Set of 6")).toBe(6);
    expect(extractPackCount("Cable 2-pack USB")).toBe(2);
    expect(extractPackCount("Single Wireless Mouse")).toBeNull();
  });
});
