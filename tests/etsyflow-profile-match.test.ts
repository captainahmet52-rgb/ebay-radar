import { describe, it, expect, vi, beforeEach } from "vitest";

// Supabase istemcisini taklit et: ilike gerçek Postgres gibi desen eşleştirir
// (kaçışsız "_" tek karakter, "%" her şey) — açığın kendisini yeniden üretir.
const rows: { id: string; email: string | null }[] = [];
let lastPattern = "";

function likeToRegex(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (ch === "%" || ch === "*") re += ".*";
    else if (ch === "_") re += ".";
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        ilike: (_col: string, pattern: string) => {
          lastPattern = pattern;
          const rx = likeToRegex(pattern);
          return {
            limit: (n: number) =>
              Promise.resolve({ data: rows.filter((r) => r.email && rx.test(r.email)).slice(0, n), error: null }),
          };
        },
      }),
    }),
  }),
}));

process.env.ETSYFLOW_SUPABASE_URL = "http://test";
process.env.ETSYFLOW_SUPABASE_SERVICE_KEY = "test";

const { resolveEtsyProfileId, escapeLikePattern } = await import("@/lib/etsyflow");

describe("resolveEtsyProfileId", () => {
  beforeEach(() => {
    rows.length = 0;
  });

  it("joker karakterli e-posta başkasının profiline eşlenmez", async () => {
    rows.push({ id: "victim", email: "victim@x.com" });

    expect(await resolveEtsyProfileId("vict_m@x.com")).toBeNull();
    expect(await resolveEtsyProfileId("%@x.com")).toBeNull();
    expect(await resolveEtsyProfileId("*")).toBeNull();
  });

  it("aynı e-postayı büyük/küçük harf farkıyla bulur", async () => {
    rows.push({ id: "p1", email: "Ahmet@Example.com" });

    expect(await resolveEtsyProfileId("ahmet@example.com")).toBe("p1");
    expect(await resolveEtsyProfileId("  AHMET@example.com ")).toBe("p1");
  });

  it("alt çizgili gerçek e-postayı kendi profiline eşler", async () => {
    rows.push({ id: "a", email: "john_doe@x.com" }, { id: "b", email: "johnXdoe@x.com" });

    expect(await resolveEtsyProfileId("john_doe@x.com")).toBe("a");
    expect(lastPattern).toBe("john\\_doe@x.com");
  });

  it("birden fazla birebir eşleşme varsa tahmin etmez", async () => {
    rows.push({ id: "a", email: "dup@x.com" }, { id: "b", email: "DUP@x.com" });

    expect(await resolveEtsyProfileId("dup@x.com")).toBeNull();
  });

  it("boş e-posta null döner", async () => {
    expect(await resolveEtsyProfileId("   ")).toBeNull();
  });
});

describe("escapeLikePattern", () => {
  it("tüm joker karakterleri kaçışlar", () => {
    expect(escapeLikePattern("a_b%c*d\\e")).toBe("a\\_b\\%c\\*d\\\\e");
  });
});
