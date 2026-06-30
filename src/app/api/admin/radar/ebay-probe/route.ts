// TEŞHİS — eBay Finding API'yi VPS'ten HAM çağırır, gerçek sonucu döndürür.
// "0 ürün" neden? → ack=Success count=0 (mağaza adı uyuşmadı) MU, yoksa
// 503/HTML (eBay edge blok / API ölü) MÜ? Bunu net ayırt etmek için.
//
// Kullanım: /api/admin/radar/ebay-probe?store=USA%20One%20Mart
// (admin girişi gerekir). Çıktıyı ekran görüntüsüyle paylaş.
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-helpers";

const FINDING_URL = "https://svcs.ebay.com/services/search/FindingService/v1";

interface ProbeResult {
  storeName: string;
  httpStatus: number;
  contentType: string;
  isJson: boolean;
  ack: string | null;
  count: number | null;
  totalEntries: string | null;
  errorMessage: string | null;
  sampleTitles: string[];
  bodyPreview: string; // JSON değilse ham gövdenin başı (edge blok teşhisi)
}

async function probeStore(appId: string, storeName: string): Promise<ProbeResult> {
  const params = new URLSearchParams({
    "OPERATION-NAME": "findItemsIneBayStores",
    "SERVICE-VERSION": "1.13.0",
    "SECURITY-APPNAME": appId,
    "RESPONSE-DATA-FORMAT": "JSON",
    "REST-PAYLOAD": "",
    storeName,
    "paginationInput.entriesPerPage": "5",
    "paginationInput.pageNumber": "1",
  });

  const res = await fetch(`${FINDING_URL}?${params.toString()}`);
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  const base: ProbeResult = {
    storeName,
    httpStatus: res.status,
    contentType: contentType.slice(0, 60),
    isJson: false,
    ack: null,
    count: null,
    totalEntries: null,
    errorMessage: null,
    sampleTitles: [],
    bodyPreview: "",
  };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // JSON değil → büyük olasılıkla eBay HTML hata sayfası (edge blok / 503)
    return { ...base, bodyPreview: text.replace(/\s+/g, " ").slice(0, 200) };
  }

  const resp = (json as {
    findItemsIneBayStoresResponse?: Array<{
      ack?: string[];
      errorMessage?: unknown;
      searchResult?: Array<{ "@count"?: string; item?: Array<{ title?: string[] }> }>;
      paginationOutput?: Array<{ totalEntries?: string[] }>;
    }>;
  }).findItemsIneBayStoresResponse?.[0];

  const sr = resp?.searchResult?.[0];
  const items = sr?.item ?? [];

  return {
    ...base,
    isJson: true,
    ack: resp?.ack?.[0] ?? null,
    count: sr?.["@count"] ? parseInt(sr["@count"], 10) : items.length,
    totalEntries: resp?.paginationOutput?.[0]?.totalEntries?.[0] ?? null,
    errorMessage: resp?.errorMessage
      ? JSON.stringify(resp.errorMessage).slice(0, 300)
      : null,
    sampleTitles: items.slice(0, 3).map((it) => it.title?.[0] ?? "").filter(Boolean),
  };
}

export const GET = requireAdmin(async (req) => {
  const appId = process.env.EBAY_CLIENT_ID;
  const appIdPresent = Boolean(appId);
  const appIdPrefix = appId ? appId.slice(0, 12) + "…" : null;

  if (!appId) {
    return NextResponse.json({
      ok: false,
      reason: "EBAY_CLIENT_ID tanımlı değil (Coolify env eksik)",
      appIdPresent,
    });
  }

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get("store")?.trim();

  // İstenen ad + yaygın varyantları dene (boşluklu görünen ad vs slug)
  const variants = requested
    ? [requested, requested.toLowerCase(), requested.replace(/\s+/g, "")]
    : ["USA One Mart", "usaonemart", "usa one mart"];
  const unique = Array.from(new Set(variants));

  const results: ProbeResult[] = [];
  for (const name of unique) {
    try {
      results.push(await probeStore(appId, name));
    } catch (err) {
      results.push({
        storeName: name,
        httpStatus: -1,
        contentType: "",
        isJson: false,
        ack: null,
        count: null,
        totalEntries: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        sampleTitles: [],
        bodyPreview: "",
      });
    }
  }

  // Kısa teşhis özeti
  const anyHtml = results.some((r) => !r.isJson && r.httpStatus !== -1);
  const anyHit = results.some((r) => (r.count ?? 0) > 0);
  let verdict: string;
  if (anyHit) verdict = "OK — en az bir mağaza adı ürün döndürdü (eşleşen adı kullan)";
  else if (anyHtml) verdict = "EDGE-BLOK/503 — eBay JSON yerine HTML hata döndürdü (Finding API VPS'ten erişilemiyor veya emekli)";
  else verdict = "BOŞ — API çalışıyor ama bu adlarla 0 ürün (mağaza adı uyuşmuyor)";

  return NextResponse.json({
    ok: true,
    appIdPresent,
    appIdPrefix,
    verdict,
    results,
  });
});
