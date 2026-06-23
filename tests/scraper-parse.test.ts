import { describe, test, expect } from "vitest";
import { parseStock, parseLocaleNumber } from "@/lib/scraper";

describe("parseLocaleNumber — çok-yerelli fiyat", () => {
  test("US formatı 1,234.56", () => expect(parseLocaleNumber("$1,234.56")).toBe(1234.56));
  test("TR/AB formatı 2.249,00", () => expect(parseLocaleNumber("2.249,00 TL")).toBe(2249));
  test("AB formatı 149,99 €", () => expect(parseLocaleNumber("149,99 €")).toBe(149.99));
  test("sade tam sayı binlik nokta 1.299", () => expect(parseLocaleNumber("1.299 TL")).toBe(1299));
  test("ondalık nokta 19.99", () => expect(parseLocaleNumber("$19.99")).toBe(19.99));
  test("boş → null", () => expect(parseLocaleNumber("abc")).toBe(null));
});

describe("parseStock — çok-dilli stok", () => {
  test("boş → unknown (in_stock VARSAYILMAZ)", () =>
    expect(parseStock("")).toEqual({ stockStatus: "unknown", stockQty: null }));

  test("EN out of stock → out", () =>
    expect(parseStock("Currently unavailable").stockStatus).toBe("out"));
  test("TR stokta yok → out", () =>
    expect(parseStock("Stokta yok").stockStatus).toBe("out"));
  test("DE nicht auf Lager → out", () =>
    expect(parseStock("Derzeit nicht auf Lager").stockStatus).toBe("out"));

  test("EN only 3 left → low(3)", () =>
    expect(parseStock("Only 3 left in stock")).toEqual({ stockStatus: "low", stockQty: 3 }));
  test("TR sadece 2 adet → low(2)", () =>
    expect(parseStock("Stokta sadece 2 adet kaldı")).toEqual({ stockStatus: "low", stockQty: 2 }));
  test("DE nur noch 5 → low(5)", () =>
    expect(parseStock("Nur noch 5 auf Lager").stockQty).toBe(5));

  test("EN in stock → in_stock", () =>
    expect(parseStock("In Stock").stockStatus).toBe("in_stock"));
  test("TR stokta → in_stock", () =>
    expect(parseStock("Stokta").stockStatus).toBe("in_stock"));

  test("anlamsız metin → unknown (güvenli taraf)", () =>
    expect(parseStock("hello world").stockStatus).toBe("unknown"));
});
