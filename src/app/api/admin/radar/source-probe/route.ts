// TEŞHİS v2 — Finding API VPS'ten ÖLÜ (503). Hangi ALTERNATİF kaynak VPS'ten
// gerçek veri döndürüyor? 3 yolu sırayla dener ve ham sonucu raporlar:
//   1) Browse API (resmi, OAuth app-token) filter=sellers: → api.ebay.com (OAuth zaten çalışıyor)
//   2) www.ebay.com/sch ham fetch (storefront host — svcs'ten farklı WAF olabilir)
//   3) www.ebay.com/str mağaza sayfası ham fetch
//
// Kullanım: /api/admin/radar/source-probe?seller=usaonemart&store=usaonemart
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { getApplicationToken } from "@/lib/ebay/oauth";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface SourceReport {
  source: string;
  httpStatus: number;
  contentType: string;
  bytes: number;
  usable: boolean;
  detail: string;
  sampleTitles: string[];
  preview: string;
}

// --- 1) Browse API: seller filtresiyle ürün ara ---
async function probeBrowse(seller: string): Promise<SourceReport> {
  const base: SourceReport = {
    source: `Browse API (filter=sellers:${seller})`,
    httpStatus: -1, contentType: "", bytes: 0, usable: false,
    detail: "", sampleTitles: [], preview: "",
  };
  try {
    const token = await getApplicationToken();
    // Browse q ZORUNLU — geniş bir terim + seller filtresi (mağaza envanteri yaklaşımı)
    const url =
      "https://api.ebay.com/buy/browse/v1/item_summary/search" +
      `?q=new&filter=sellers:{${encodeURIComponent(seller)}}&limit=10`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch {
      return { ...base, httpStatus: res.status, contentType: ct.slice(0, 50), bytes: text.length, preview: text.replace(/\s+/g, " ").slice(0, 200) };
    }
    const j = json as {
      total?: number;
      itemSummaries?: Array<{ title?: string }>;
      errors?: Array<{ message?: string; longMessage?: string }>;
      warnings?: Array<{ message?: string }>;
    };
    const items = j.itemSummaries ?? [];
    const err = j.errors?.[0]?.longMessage ?? j.errors?.[0]?.message ?? j.warnings?.[0]?.message ?? "";
    return {
      ...base,
      httpStatus: res.status,
      contentType: ct.slice(0, 50),
      bytes: text.length,
      usable: items.length > 0,
      detail: `total=${j.total ?? 0} dönen=${items.length}` + (err ? ` | ${err.slice(0, 150)}` : ""),
      sampleTitles: items.slice(0, 3).map((it) => it.title ?? "").filter(Boolean),
    };
  } catch (err) {
    return { ...base, detail: err instanceof Error ? err.message : String(err) };
  }
}

// --- HTML scrape ortak ---
async function probeHtml(source: string, url: string): Promise<SourceReport> {
  const base: SourceReport = {
    source, httpStatus: -1, contentType: "", bytes: 0, usable: false,
    detail: "", sampleTitles: [], preview: "",
  };
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    const ct = res.headers.get("content-type") ?? "";
    const text = await res.text();
    // Ürün işaretçileri: eBay arama sonuç kartları
    const itemMatches = text.match(/class="s-item__title"|class="s-item "|srp-results|s-item__link/g);
    const isErrorPage = /Error Page \| eBay|Something went wrong/i.test(text);
    // Başlık örnekleri (s-item__title span içeriği)
    const titleRe = /class="s-item__title"[^>]*>(?:<span[^>]*>)?([^<]{8,120})</g;
    const titles: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = titleRe.exec(text)) && titles.length < 3) {
      const t = m[1].trim();
      if (t && t.toLowerCase() !== "shop on ebay") titles.push(t);
    }
    return {
      ...base,
      httpStatus: res.status,
      contentType: ct.slice(0, 50),
      bytes: text.length,
      usable: !isErrorPage && (itemMatches?.length ?? 0) > 0,
      detail: isErrorPage
        ? "eBay HATA SAYFASI (edge blok)"
        : `ürün-işaretçi=${itemMatches?.length ?? 0}`,
      sampleTitles: titles,
      preview: text.replace(/\s+/g, " ").slice(0, 160),
    };
  } catch (err) {
    return { ...base, detail: err instanceof Error ? err.message : String(err) };
  }
}

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const seller = (searchParams.get("seller") ?? "usaonemart").trim();
  const store = (searchParams.get("store") ?? seller).trim();

  const reports: SourceReport[] = [];
  reports.push(await probeBrowse(seller));
  reports.push(await probeHtml(`www.ebay.com/sch ?_ssn=${seller}`, `https://www.ebay.com/sch/i.html?_ssn=${encodeURIComponent(seller)}&_ipg=60&_pgn=1`));
  reports.push(await probeHtml(`www.ebay.com/str/${store}`, `https://www.ebay.com/str/${encodeURIComponent(store)}`));

  const winner = reports.find((r) => r.usable);
  const verdict = winner
    ? `KULLANILABİLİR → ${winner.source}`
    : "HİÇBİRİ — tüm alternatifler VPS'ten kapalı (ScrapingBee/proxy gerekecek)";

  return NextResponse.json({ ok: true, seller, store, verdict, reports });
});
