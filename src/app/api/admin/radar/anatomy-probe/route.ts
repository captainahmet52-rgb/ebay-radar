// TEŞHİS v4 (anatomi) — mağaza sayfasının GERÇEK yapısını gör. Username ve item'lar
// HTML'de NEREDE? Tahmin yerine ham parçalar döndür. Tam tarayıcı başlıklarıyla çek
// (39KB kırpık değil, 774KB tam sayfa için Accept + sec-fetch şart).
//
// Kullanım: /api/admin/radar/anatomy-probe?store=usaonemart
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";

const FULL_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

function snippet(html: string, needle: string, before = 80, after = 240): string | null {
  const idx = html.indexOf(needle);
  if (idx < 0) return null;
  return html
    .slice(Math.max(0, idx - before), idx + after)
    .replace(/\s+/g, " ")
    .trim();
}

function countOcc(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const store = (searchParams.get("store") ?? "usaonemart").trim();
  const url = `https://www.ebay.com/str/${encodeURIComponent(store)}`;

  let html = "";
  let status = -1;
  let ctype = "";
  try {
    const res = await fetch(url, { headers: FULL_HEADERS, redirect: "follow" });
    status = res.status;
    ctype = res.headers.get("content-type") ?? "";
    html = await res.text();
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }

  // İşaretçi sayıları — item'lar ve username HTML'de var mı?
  const counts = {
    itm_links: countOcc(html, /\/itm\/\d+/g),
    ssn: countOcc(html, /_ssn=/g),
    usr_links: countOcc(html, /\/usr\//g),
    username_json: countOcc(html, /"username"/g),
    sellerName: countOcc(html, /sellerName/gi),
    seller_word: countOcc(html, /seller/gi),
    str_links: countOcc(html, /\/str\//g),
    application_json_ld: countOcc(html, /application\/ld\+json/g),
    title_marker: countOcc(html, /s-item__title|str-item-card|item-title|str-quickview/gi),
  };

  // Anahtar yerlerden ham parçalar (yapıyı gözle gör)
  const snippets: Record<string, string | null> = {
    first_itm: snippet(html, "/itm/"),
    first_ssn: snippet(html, "_ssn="),
    first_usr: snippet(html, "/usr/"),
    first_username: snippet(html, '"username"'),
    first_sellerName: snippet(html, "sellerName"),
    ld_json: snippet(html, "application/ld+json", 10, 400),
    sec_seller: snippet(html, "seller", 40, 200),
  };

  // Sayfa başı (kırpık/challenge mi tam sayfa mı anla)
  const head = html.replace(/\s+/g, " ").slice(0, 220);

  return NextResponse.json({
    ok: true,
    store,
    status,
    ctype: ctype.slice(0, 50),
    htmlBytes: html.length,
    head,
    counts,
    snippets,
  });
});
