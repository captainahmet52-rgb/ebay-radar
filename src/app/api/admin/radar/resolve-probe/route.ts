// TEŞHİS v5 (uçtan uca) — Browse API tek ayakta kalan kaynak. Mağaza scrape ölü,
// username artık HTML'de yok (JS-render). ÇÖZÜM: mağazadan TEK item linki →
// Browse getItem → seller.username → Browse ile tüm katalog (enumeration).
//
// Bu probe tüm zinciri kanıtlar:
//   1) legacy itemId → getItemByLegacyId → seller.username (gerçek satıcı adı)
//   2) o username ile birkaç enumeration stratejisi dene → en çok ürün döndüreni bul
//
// Kullanım: /api/admin/radar/resolve-probe?itemUrl=https://www.ebay.com/itm/123456789
//      veya: /api/admin/radar/resolve-probe?itemId=123456789
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { getApplicationToken } from "@/lib/ebay/oauth";

const BROWSE = "https://api.ebay.com/buy/browse/v1";

function browseHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    "Content-Type": "application/json",
  };
}

interface EnumStrategy {
  label: string;
  query: string;
  httpStatus: number;
  total: number;
  returned: number;
  error: string;
  sampleTitles: string[];
}

async function tryEnum(token: string, label: string, query: string): Promise<EnumStrategy> {
  const res = await fetch(`${BROWSE}/item_summary/search?${query}`, { headers: browseHeaders(token) });
  const text = await res.text();
  let j: {
    total?: number;
    itemSummaries?: Array<{ title?: string }>;
    warnings?: Array<{ message?: string; longMessage?: string }>;
    errors?: Array<{ message?: string; longMessage?: string }>;
  } = {};
  try { j = JSON.parse(text); } catch { /* boş */ }
  const items = j.itemSummaries ?? [];
  const msg = [...(j.warnings ?? []), ...(j.errors ?? [])]
    .map((w) => w.longMessage ?? w.message ?? "").join(" | ").slice(0, 180);
  return {
    label, query,
    httpStatus: res.status,
    total: j.total ?? 0,
    returned: items.length,
    error: msg,
    sampleTitles: items.slice(0, 3).map((it) => it.title ?? "").filter(Boolean),
  };
}

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const itemUrl = searchParams.get("itemUrl") ?? "";
  const itemIdParam = searchParams.get("itemId") ?? "";
  // URL'den ya da paramdan legacy item id (ardışık rakamlar) çıkar
  const legacyId = (itemIdParam.match(/\d{9,}/)?.[0]) ?? (itemUrl.match(/\/itm\/(?:[^/]*\/)?(\d{9,})/)?.[1]) ?? itemUrl.match(/\d{9,}/)?.[0];

  if (!legacyId) {
    return NextResponse.json({ ok: false, reason: "Geçerli item id/URL ver (örn. itemUrl=https://www.ebay.com/itm/123456789012)" });
  }

  const token = await getApplicationToken().catch((e) => {
    return null as null;
  });
  if (!token) return NextResponse.json({ ok: false, reason: "Browse token alınamadı" });

  // 1) item → seller.username
  const itemRes = await fetch(
    `${BROWSE}/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`,
    { headers: browseHeaders(token) },
  );
  const itemText = await itemRes.text();
  let itemJson: {
    title?: string;
    seller?: { username?: string; feedbackPercentage?: string };
    errors?: Array<{ message?: string; longMessage?: string }>;
  } = {};
  try { itemJson = JSON.parse(itemText); } catch { /* boş */ }

  const username = itemJson.seller?.username ?? null;
  if (!username) {
    return NextResponse.json({
      ok: false,
      legacyId,
      reason: "getItem seller.username vermedi",
      itemHttpStatus: itemRes.status,
      itemError: itemJson.errors?.[0]?.longMessage ?? itemJson.errors?.[0]?.message ?? null,
      itemPreview: itemText.replace(/\s+/g, " ").slice(0, 200),
    });
  }

  // 2) bu username ile enumeration stratejileri (tüm-mağaza dökümü için en iyisini bul)
  const u = encodeURIComponent(username);
  const strategies = await Promise.all([
    tryEnum(token, "sadece-seller", `filter=sellers:{${u}}&limit=50`),
    tryEnum(token, "category0+seller", `category_ids=0&filter=sellers:{${u}}&limit=50`),
    tryEnum(token, "q=new+seller", `q=new&filter=sellers:{${u}}&limit=50`),
    tryEnum(token, "q=*+seller", `q=*&filter=sellers:{${u}}&limit=50`),
  ]);

  const best = [...strategies].sort((a, b) => b.returned - a.returned)[0];
  const verdict = best && best.returned > 0
    ? `ÇÖZÜLDÜ → username="${username}" | en iyi sorgu: "${best.label}" (${best.returned} ürün, total=${best.total})`
    : `username="${username}" bulundu ama hiçbir enumeration sorgusu ürün döndürmedi`;

  return NextResponse.json({
    ok: true,
    legacyId,
    username,
    sellerFeedback: itemJson.seller?.feedbackPercentage ?? null,
    itemTitle: itemJson.title ?? null,
    verdict,
    strategies,
  });
});
