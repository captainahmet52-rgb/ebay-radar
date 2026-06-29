import { describe, test, expect } from "vitest";
import {
  resizeGray,
  dHash,
  pHash,
  hamming,
  type Grayscale,
} from "@/lib/radar/image-hash";
import {
  compareGray,
  imageVerdict,
  makeUrlComparator,
  IMG_STRONG_PHASH,
} from "@/lib/radar/image-compare";
import { refineWithImageEvidence } from "@/lib/radar/image-evidence";
import { selectRadarMatch, type RadarCandidate } from "@/lib/radar/source-matcher";
import type { UrlImageComparator } from "@/lib/radar/image-compare";

function makeGray(w: number, h: number, fn: (x: number, y: number) => number): Grayscale {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data[y * w + x] = Math.max(0, Math.min(255, Math.round(fn(x, y))));
  return { width: w, height: h, data };
}

// ─── image-hash (saf matematik) ──────────────────────────────────────────────
describe("image-hash", () => {
  test("hamming temel", () => {
    expect(hamming({ hi: 0, lo: 0b1011 }, { hi: 0, lo: 0b1011 })).toBe(0);
    expect(hamming({ hi: 0, lo: 0b1011 }, { hi: 0, lo: 0b1000 })).toBe(2);
    expect(hamming({ hi: 0b101, lo: 0 }, { hi: 0b001, lo: 0 })).toBe(1); // üst yarım da sayılır
  });

  test("resizeGray hedef boyuta indirir", () => {
    const img = makeGray(64, 64, (x) => x * 4);
    const r = resizeGray(img, 8, 8);
    expect(r.width).toBe(8);
    expect(r.height).toBe(8);
    expect(r.data.length).toBe(64);
  });

  test("aynı görüntü → dHash/pHash mesafesi 0", () => {
    const img = makeGray(40, 40, (x, y) => (x * 6 + y * 3) % 256);
    expect(hamming(dHash(img), dHash(img))).toBe(0);
    expect(hamming(pHash(img), pHash(img))).toBe(0);
  });

  test("farklı yapı (yatay vs dikey gradyan) → pHash mesafesi > 0", () => {
    const a = makeGray(40, 40, (x) => x * 6); // yatay artan
    const b = makeGray(40, 40, (_x, y) => y * 6); // dikey artan
    expect(hamming(pHash(a), pHash(b))).toBeGreaterThan(0);
  });

  test("dHash yatay yönü yakalar (artan vs azalan)", () => {
    const inc = makeGray(40, 40, (x) => x * 6); // soldan sağa ARTAN → bitler 0
    const dec = makeGray(40, 40, (x) => (40 - x) * 6); // AZALAN → bitler 1
    expect(hamming(dHash(inc), dHash(dec))).toBeGreaterThan(0);
  });

  test("hafif gürültü pHash'i az değiştirir (dayanıklılık)", () => {
    const base = makeGray(48, 48, (x, y) => ((x * 5 + y * 7) % 200) + 20);
    const noisy = makeGray(48, 48, (x, y) => {
      const v = ((x * 5 + y * 7) % 200) + 20;
      return v + ((x + y) % 2 === 0 ? 4 : -4); // ±4 gürültü
    });
    expect(hamming(pHash(base), pHash(noisy))).toBeLessThanOrEqual(IMG_STRONG_PHASH);
  });
});

// ─── image-compare ───────────────────────────────────────────────────────────
describe("image-compare", () => {
  test("imageVerdict eşikleri", () => {
    expect(imageVerdict({ phash: 2, dhash: 3 })).toBe("same");
    expect(imageVerdict({ phash: 10, dhash: 8 })).toBe("similar");
    expect(imageVerdict({ phash: 30, dhash: 28 })).toBe("different");
  });

  test("compareGray aynı görüntü → {0,0}", () => {
    const img = makeGray(40, 40, (x, y) => (x * 4 + y * 2) % 256);
    expect(compareGray(img, img)).toEqual({ phash: 0, dhash: 0 });
  });

  test("makeUrlComparator: aynı URL → {0,0} (indirmeden)", async () => {
    const cmp = makeUrlComparator(async () => null); // yükleyici çağrılmamalı
    expect(await cmp("http://x/a.jpg", "http://x/a.jpg")).toEqual({ phash: 0, dhash: 0 });
  });

  test("makeUrlComparator: biri decode edilemezse → null", async () => {
    const img = makeGray(40, 40, (x) => x * 6);
    const load = async (u: string) => (u.includes("ok") ? img : null);
    const cmp = makeUrlComparator(load);
    expect(await cmp("http://x/ok.jpg", "http://x/bad.webp")).toBeNull();
  });
});

// ─── image-evidence (enjekte edilmiş karşılaştırıcı) ─────────────────────────
const cand = (over: Partial<RadarCandidate> & Pick<RadarCandidate, "asin">): RadarCandidate => ({
  title: "",
  price: null,
  ...over,
});

// belirli ASIN görsel URL'lerine sabit benzerlik döndüren sahte karşılaştırıcı
function fakeComparator(map: Record<string, { phash: number; dhash: number }>): UrlImageComparator {
  return async (_src, candUrl) => map[candUrl] ?? null;
}

describe("refineWithImageEvidence", () => {
  const headphonesItem = {
    title: "Sony WH-1000XM4 Wireless Headphones",
    price: 300,
    imageUrl: "http://ebay/src.jpg",
  };
  const variants = [
    cand({ asin: "B08BLACK01", title: "Sony WH-1000XM4 Wireless Headphones Black", price: 200, imageUrl: "http://amz/black.jpg" }),
    cand({ asin: "B08SILVER1", title: "Sony WH-1000XM4 Wireless Headphones Silver", price: 205, imageUrl: "http://amz/silver.jpg" }),
  ];

  test("review + tek güçlü görsel eşleşme → accept (Sözleşme C)", async () => {
    const base = selectRadarMatch(headphonesItem, variants);
    expect(base.decision).toBe("review"); // belirsiz varyant

    const refined = await refineWithImageEvidence(
      headphonesItem,
      base,
      fakeComparator({
        "http://amz/black.jpg": { phash: 2, dhash: 3 }, // aynı
        "http://amz/silver.jpg": { phash: 30, dhash: 28 }, // farklı
      }),
    );
    expect(refined.decision).toBe("accept");
    expect(refined.contract).toBe("C");
    expect(refined.asin).toBe("B08BLACK01");
  });

  test("iki görsel de güçlü eşleşirse → review kalır (varyant belirsizliği)", async () => {
    const base = selectRadarMatch(headphonesItem, variants);
    const refined = await refineWithImageEvidence(
      headphonesItem,
      base,
      fakeComparator({
        "http://amz/black.jpg": { phash: 2, dhash: 3 },
        "http://amz/silver.jpg": { phash: 3, dhash: 4 },
      }),
    );
    expect(refined.decision).toBe("review");
  });

  const acceptItem = {
    title: "Sony WH-1000XM4 Wireless Headphones",
    price: 300,
    imageUrl: "http://ebay/src.jpg",
  };
  const single = [
    cand({ asin: "B08ACC0001", title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones Black", price: 200, imageUrl: "http://amz/acc.jpg" }),
  ];

  test("accept + görsel teyit → accept kalır, sözleşme +img", async () => {
    const base = selectRadarMatch(acceptItem, single);
    expect(base.decision).toBe("accept");
    const refined = await refineWithImageEvidence(
      acceptItem,
      base,
      fakeComparator({ "http://amz/acc.jpg": { phash: 2, dhash: 2 } }),
    );
    expect(refined.decision).toBe("accept");
    expect(refined.contract?.endsWith("+img")).toBe(true);
  });

  test("accept + görsel ÇELİŞİR → review'a iner (savunma)", async () => {
    const base = selectRadarMatch(acceptItem, single);
    expect(base.decision).toBe("accept");
    const refined = await refineWithImageEvidence(
      acceptItem,
      base,
      fakeComparator({ "http://amz/acc.jpg": { phash: 32, dhash: 30 } }),
    );
    expect(refined.decision).toBe("review");
    expect(refined.reason).toContain("çelişiyor");
  });

  test("kaynak görseli yoksa → base aynen döner", async () => {
    const noImgItem = { title: "Sony WH-1000XM4 Wireless Headphones", price: 300 };
    const base = selectRadarMatch(noImgItem, single);
    const refined = await refineWithImageEvidence(
      noImgItem,
      base,
      fakeComparator({ "http://amz/acc.jpg": { phash: 2, dhash: 2 } }),
    );
    expect(refined.decision).toBe(base.decision);
    expect(refined.contract).toBe(base.contract);
  });
});
