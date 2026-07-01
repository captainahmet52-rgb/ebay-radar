// TEŞHİS — "satılan ürün" verisi bizim app'ten erişilebilir mi?
// İki resmi kaynağı VPS'ten dener:
//   1) Browse getItem → estimatedAvailabilities.estimatedSoldQuantity (ürün başına satış tahmini)
//   2) Marketplace Insights item_sales/search (resmi satış verisi — özel scope gerektirir)
//
// Kullanım: /api/admin/radar/sold-probe?seller=md.asifpa-0&itemId=365979402122
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";
import { getApplicationToken } from "@/lib/ebay/oauth";

const BROWSE = "https://api.ebay.com/buy/browse/v1";
const INSIGHTS = "https://api.ebay.com/buy/marketplace_insights/v1";

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
    "Content-Type": "application/json",
  };
}

interface GetItemSoldReport {
  itemId: string;
  title: string;
  httpStatus: number;
  estimatedSoldQuantity: number | null;
  estimatedAvailabilityStatus: string | null;
  estimatedRemainingQuantity: number | null;
  rawAvailabilities: string; // ham (alan var mı gör)
}

async function probeGetItem(token: string, legacyId: string): Promise<GetItemSoldReport> {
  const res = await fetch(
    `${BROWSE}/item/get_item_by_legacy_id?legacy_item_id=${encodeURIComponent(legacyId)}`,
    { headers: headers(token) },
  );
  const text = await res.text();
  let j: {
    title?: string;
    estimatedAvailabilities?: Array<{
      estimatedAvailabilityStatus?: string;
      estimatedSoldQuantity?: number;
      estimatedRemainingQuantity?: number;
    }>;
  } = {};
  try { j = JSON.parse(text); } catch { /* boş */ }
  const av = j.estimatedAvailabilities?.[0];
  return {
    itemId: legacyId,
    title: (j.title ?? "").slice(0, 70),
    httpStatus: res.status,
    estimatedSoldQuantity: av?.estimatedSoldQuantity ?? null,
    estimatedAvailabilityStatus: av?.estimatedAvailabilityStatus ?? null,
    estimatedRemainingQuantity: av?.estimatedRemainingQuantity ?? null,
    rawAvailabilities: JSON.stringify(j.estimatedAvailabilities ?? null).slice(0, 300),
  };
}

export const GET = requireAdmin(async (req) => {
  const { searchParams } = new URL(req.url);
  const seller = (searchParams.get("seller") ?? "md.asifpa-0").trim();
  const itemId = (searchParams.get("itemId") ?? "365979402122").trim();

  const token = await getApplicationToken().catch(() => null);
  if (!token) return NextResponse.json({ ok: false, reason: "Browse token alınamadı" });

  // 1) Verilen item + satıcının ilk birkaç ilanında getItem sold verisi
  const getItemReports: GetItemSoldReport[] = [];
  getItemReports.push(await probeGetItem(token, itemId));

  // Satıcının aktif ilanlarından 3 örnek al, onlarda da getItem dene
  try {
    const sres = await fetch(
      `${BROWSE}/item_summary/search?category_ids=0&filter=sellers:{${encodeURIComponent(seller)}}&limit=3`,
      { headers: headers(token) },
    );
    const sdata = (await sres.json()) as { itemSummaries?: Array<{ legacyItemId?: string; itemId?: string }> };
    for (const it of sdata.itemSummaries ?? []) {
      const legacy = it.legacyItemId ?? it.itemId?.split("|")[1];
      if (legacy && legacy !== itemId) {
        getItemReports.push(await probeGetItem(token, legacy));
      }
    }
  } catch { /* örnekleme başarısız → sadece verilen item raporlanır */ }

  // 2) Marketplace Insights — satılan ürünler (özel scope gerektirir)
  let insights: { httpStatus: number; ok: boolean; total: number | null; error: string; preview: string };
  try {
    const ires = await fetch(
      `${INSIGHTS}/item_sales/search?q=&category_ids=0&filter=sellers:{${encodeURIComponent(seller)}}&limit=3`,
      { headers: headers(token) },
    );
    const itext = await ires.text();
    let ij: { total?: number; errors?: Array<{ message?: string; longMessage?: string }> } = {};
    try { ij = JSON.parse(itext); } catch { /* HTML olabilir */ }
    insights = {
      httpStatus: ires.status,
      ok: ires.ok,
      total: ij.total ?? null,
      error: (ij.errors?.[0]?.longMessage ?? ij.errors?.[0]?.message ?? "").slice(0, 200),
      preview: itext.replace(/\s+/g, " ").slice(0, 160),
    };
  } catch (err) {
    insights = { httpStatus: -1, ok: false, total: null, error: err instanceof Error ? err.message : String(err), preview: "" };
  }

  // Karar
  const soldAvailable = getItemReports.some((r) => r.estimatedSoldQuantity !== null);
  const insightsAvailable = insights.ok && insights.total !== null;
  let verdict: string;
  if (insightsAvailable) verdict = "EN İYİ → Marketplace Insights erişilebilir (gerçek satış verisi)";
  else if (soldAvailable) verdict = "KULLANILABİLİR → Browse getItem estimatedSoldQuantity veriyor (ürün başına satış tahmini)";
  else verdict = "SATIŞ VERİSİ YOK — ne getItem ne Insights satış adedi döndürdü (aktif ilan sayısıyla devam)";

  return NextResponse.json({ ok: true, seller, verdict, getItemReports, insights });
});
