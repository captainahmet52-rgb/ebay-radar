"use client";
import useSWR from "swr";

interface StockHealth {
  products: {
    total: number; active: number; paused: number;
    staleActive: number; scrapeFailing: number; freshlyScraped: number; neverScraped: number;
  };
  listings: { active: number; paused: number };
  pauseReasons: { reason: string; count: number }[];
  tiers: { tier: string; count: number }[];
  recentErrors: { asin: string; scrapeFailCount: number; lastScrapeError: string | null; lastScrapedAt: string | null }[];
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<StockHealth>;

const REASON_LABEL: Record<string, string> = {
  out_of_stock: "Stok tükendi", low_stock: "Az stok", price_spike: "Fiyat zıplaması",
  floor: "Taban altı", stale: "Bayat veri (taranamadı)", manual: "Manuel", "—": "Belirtilmemiş",
};

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/60">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

export default function StockHealthPage() {
  const { data, isLoading } = useSWR("/api/admin/stock-health", fetcher, { refreshInterval: 30000 });

  if (isLoading || !data) {
    return <p className="text-slate-400 text-sm">Yükleniyor…</p>;
  }

  const p = data.products;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold">Stok Sağlığı</h1>
        <p className="text-sm text-slate-400 mt-1">Stok/fiyat takibinin durumu (30 sn'de bir yenilenir).</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Toplam ürün" value={p.total} />
        <Stat label="Aktif" value={p.active} tone="good" />
        <Stat label="Duraklatılmış" value={p.paused} tone={p.paused > 0 ? "warn" : "default"} />
        <Stat label="Son 1 saatte tarandı" value={p.freshlyScraped} tone="good" />
        <Stat label="Bayat (6+ saat)" value={p.staleActive} tone={p.staleActive > 0 ? "bad" : "good"} />
        <Stat label="Tarama hatası olan" value={p.scrapeFailing} tone={p.scrapeFailing > 0 ? "bad" : "good"} />
        <Stat label="Hiç taranmamış" value={p.neverScraped} tone={p.neverScraped > 0 ? "warn" : "default"} />
        <Stat label="Aktif listing" value={data.listings.active} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/60">
          <h2 className="font-semibold text-sm mb-3">Duraklatma sebepleri</h2>
          {data.pauseReasons.length === 0 ? (
            <p className="text-slate-500 text-sm">Duraklatılmış ürün yok 🎉</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {data.pauseReasons.map((r) => (
                <li key={r.reason} className="flex justify-between">
                  <span className="text-slate-300">{REASON_LABEL[r.reason] ?? r.reason}</span>
                  <span className="font-mono text-slate-400">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/60">
          <h2 className="font-semibold text-sm mb-3">Tarama grubu (aktif)</h2>
          <ul className="space-y-1.5 text-sm">
            {data.tiers.map((t) => (
              <li key={t.tier} className="flex justify-between">
                <span className="text-slate-300">{t.tier === "hot" ? "🔥 Sıcak (15dk)" : t.tier === "normal" ? "Normal (2sa)" : "Ölü (12sa)"}</span>
                <span className="font-mono text-slate-400">{t.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.recentErrors.length > 0 && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <h2 className="font-semibold text-sm mb-3 text-red-300">Tarama hatası olan ürünler</h2>
          <div className="space-y-2">
            {data.recentErrors.map((e) => (
              <div key={e.asin} className="text-xs flex items-start justify-between gap-3 border-b border-slate-700/30 pb-2">
                <div>
                  <span className="font-mono text-violet-400">{e.asin}</span>
                  <span className="text-slate-500 ml-2">{e.scrapeFailCount} hata</span>
                  <p className="text-slate-500 mt-0.5 max-w-md truncate">{e.lastScrapeError ?? "—"}</p>
                </div>
                <span className="text-slate-600 whitespace-nowrap">
                  {e.lastScrapedAt ? new Date(e.lastScrapedAt).toLocaleString("tr-TR") : "hiç"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
