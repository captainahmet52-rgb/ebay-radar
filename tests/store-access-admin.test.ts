import { describe, it, expect } from "vitest";
import { adminPaidUntil, ADMIN_COMP_UNTIL, STORE_SUBSCRIPTION_DAYS, addDays } from "@/lib/store-access";

const NOW = new Date("2026-10-21T12:00:00Z");

describe("adminPaidUntil", () => {
  it("süre seçilmezse ve aktif süre yoksa varsayılan 30 gün verir (süresiz DEĞİL)", () => {
    expect(adminPaidUntil(null, undefined, NOW)).toEqual(addDays(NOW, STORE_SUBSCRIPTION_DAYS));
  });

  it("süre seçilmezse mevcut geçerli bitiş tarihine dokunmaz (paket değişikliği)", () => {
    const current = addDays(NOW, 12);
    expect(adminPaidUntil(current, undefined, NOW)).toEqual(current);
  });

  it("seçilen gün sayısını bugünden başlatır", () => {
    expect(adminPaidUntil(null, "90", NOW)).toEqual(addDays(NOW, 90));
  });

  it("süresi dolmamış mağazayı uzatırken kalan günler kaybolmaz", () => {
    const current = addDays(NOW, 10);
    expect(adminPaidUntil(current, "30", NOW)).toEqual(addDays(current, 30));
  });

  it("süresi dolmuş mağazayı uzatırken bugünden başlatır", () => {
    const expired = addDays(NOW, -5);
    expect(adminPaidUntil(expired, "30", NOW)).toEqual(addDays(NOW, 30));
  });

  it("'comp' seçilirse süresiz (hediye) erişim verir", () => {
    expect(adminPaidUntil(null, "comp", NOW)).toEqual(ADMIN_COMP_UNTIL);
  });

  it("süresiz hediyeden süreli pakete geçerken 2099'a eklemez, bugünden başlatır", () => {
    expect(adminPaidUntil(ADMIN_COMP_UNTIL, "30", NOW)).toEqual(addDays(NOW, 30));
  });
});
