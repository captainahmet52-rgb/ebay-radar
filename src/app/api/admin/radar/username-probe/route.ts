// TEŞHİS v3 — Browse API çalışıyor AMA mağaza slug'ı (usaonemart) geçerli satıcı
// kullanıcı adı DEĞİL. Çözüm: erişebildiğimiz /str/ mağaza sayfasından (200, 774KB)
// gerçek username'i ayıkla → Browse'da test et.
//
// 1) /str/{store} HTML çek (VPS'ten erişilebiliyor) → username adaylarını çıkar
// 2) Her aday için Browse filter=sellers:{aday} dene → geçerli olanı + ürün sayısını bul
//
// Kullanım: /api/admin/radar/username-probe?store=usaonemart
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { getApplicationToken } from "@/lib/ebay/oauth";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const NON_USERNAMES = new Set([
  "ebay", "ebaystatic", "www", "http", "https", "html", "css", "js",
  "store", "stores", "str", "usr", "sch", "itm", "p", "b", "n",
]);

/** Mağaza sayfası HTML'inden olası satıcı kullanıcı adlarını sıklığa göre çıkarır. */
function extractUsernames(html: string): { name: string; hits: number }[] {
  const counts = new Map<string, number>();
  const bump = (raw: string | undefined) => {
    if (!raw) return;
    const n = raw.trim();
    if (n.length < 3 || n.length > 64) return;
    if (NON_USERNAMES.has(n.toLowerCase())) return;
    if (!/^[A-Za-z0-9_.*-]+$/.test(n)) return;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  };
  const patterns = [
    /[?&]_ssn=([A-Za-z0-9_.*-]+)/g,
    /\/usr\/([A-Za-z0-9_.*-]+)/g,
    /"username"\s*:\s*"([^"]+)"/g,
    /"sellerName"\s*:\s*"([^"]+)"/g,
    /"seller"\s*:\s*\{[^}]*?"username"\s*:\s*"([^"]+)"/g,
    /sellerId["']?\s*[:=]\s*["']([^"']+)["']/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) bump(m[1]);
  }
  return [...counts.entries()]
    .map(([name, hits]) => ({ name, hits }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 6);
}

interface BrowseTest {
  username: string;
  httpStatus: number;
  total: number;
  returned: number;
  invalidSeller: boolean; // "username invalid" uyarısı geldi mi?
  sampleTitles: string[];
  note: string;
}

async function testBrowseSeller(token: string, username: string): Promise<BrowseTest> {
  const url =
    "https://api.ebay.com/buy/browse/v1/item_summary/search" +
    `?q=new&filter=sellers:{${encodeURIComponent(username)}}&limit=10`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let j: {
    total?: number;
    itemSummaries?: Array<{ title?: string }>;
    warnings?: Array<{ message?: string; longMessage?: string }>;
    errors?: Array<{ message?: string; longMessage?: string }>;
  } = {};
  try { j = JSON.parse(text); } catch { /* boş bırak */ }
  const items = j.itemSummaries ?? [];
  const msgs = [...(j.warnings ?? []), ...(j.errors ?? [])]
    .map((w) => w.longMessage ?? w.message ?? "")
    .join(" | ");
  const invalidSeller = /seller .*username.* invalid|invalid.*seller/i.test(msgs);
  return {
    username,
    httpStatus: res.status,
    total: j.total ?? 0,
    returned: items.length,
    invalidSeller,
    sampleTitles: items.slice(0, 3).map((it) => it.title ?? "").filter(Boolean),
    note: msgs.slice(0, 160),
  };
}

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const store = (searchParams.get("store") ?? "usaonemart").trim();

  // 1) Mağaza sayfasını çek (VPS'ten erişilebilir)
  let html = "";
  let storeStatus = -1;
  try {
    const res = await fetch(`https://www.ebay.com/str/${encodeURIComponent(store)}`, {
      headers: { "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
    });
    storeStatus = res.status;
    html = await res.text();
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: "Mağaza sayfası çekilemedi",
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const candidates = extractUsernames(html);

  // 2) Adayları Browse'da test et (en çok 5)
  const token = await getApplicationToken().catch(() => null);
  const browseTests: BrowseTest[] = [];
  if (token) {
    for (const c of candidates.slice(0, 5)) {
      try {
        browseTests.push(await testBrowseSeller(token, c.name));
      } catch (err) {
        browseTests.push({
          username: c.name, httpStatus: -1, total: 0, returned: 0,
          invalidSeller: false, sampleTitles: [],
          note: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const valid = browseTests.find((t) => !t.invalidSeller && t.returned > 0);
  const verdict = !token
    ? "Browse token alınamadı"
    : valid
      ? `GEÇERLİ USERNAME → "${valid.username}" (Browse'da ${valid.returned} ürün döndü)`
      : "Geçerli username bulunamadı — adaylar Browse'da reddedildi (HTML'den başka kalıp gerekebilir)";

  return NextResponse.json({
    ok: true,
    store,
    storeStatus,
    htmlBytes: html.length,
    verdict,
    candidates,
    browseTests,
  });
});
