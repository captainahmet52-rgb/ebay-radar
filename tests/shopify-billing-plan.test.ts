import { describe, it, expect } from "vitest";
import { resolvePaidShopifyPlan, subscriptionName, getShopifyPlan } from "@/lib/shopify/billing";

const starter = getShopifyPlan("starter")!;
const pro = getShopifyPlan("pro")!;

function sub(planName: string, amount: string, currencyCode = "USD", status = "ACTIVE") {
  return { status, name: `Lean Automation — ${planName}`, price: { amount, currencyCode } };
}

describe("resolvePaidShopifyPlan", () => {
  it("paket, Shopify'daki aboneliğin adı ve fiyatından belirlenir", () => {
    expect(resolvePaidShopifyPlan(sub("Starter", "100.0"))?.id).toBe("starter");
    expect(resolvePaidShopifyPlan(sub("Pro", "400.00"))?.id).toBe("pro");
  });

  it("Starter ödeyip URL'de plan=pro yazmak Pro vermez (paket URL'den okunmaz)", () => {
    // Fonksiyon URL'deki planı hiç almaz; ödenen abonelik Starter ise sonuç Starter'dır.
    expect(resolvePaidShopifyPlan(sub("Starter", "100.0"))?.id).not.toBe("pro");
  });

  it("ad ile fiyat uyuşmazsa paket verilmez", () => {
    expect(resolvePaidShopifyPlan(sub("Pro", "100.0"))).toBeNull();
  });

  it("USD dışı para birimi veya aktif olmayan abonelik paket vermez", () => {
    expect(resolvePaidShopifyPlan(sub("Starter", "100.0", "EUR"))).toBeNull();
    expect(resolvePaidShopifyPlan(sub("Starter", "100.0", "USD", "PENDING"))).toBeNull();
  });

  it("abonelik bulunamazsa null döner", () => {
    expect(resolvePaidShopifyPlan(null)).toBeNull();
  });

  it("abonelik adı oluşturma ve doğrulamada aynıdır", () => {
    expect(subscriptionName(starter)).toBe("Lean Automation — Starter");
    expect(subscriptionName(pro)).toBe("Lean Automation — Pro");
  });
});
