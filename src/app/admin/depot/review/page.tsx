"use client";
import useSWR from "swr";
import { useState } from "react";

interface ReviewItem {
  id: string;
  asin: string;
  title: string | null;
  imageUrl: string | null;
  amazonPrice: number | null;
  calculatedEbayPrice: number | null;
  competitorPrice: number | null;
  soldCount: number | null;
  projectedProfit: number | null;
  rankScore: number;
  sourceKeyword: string | null;
  createdAt: string;
  sourceStore: { ebayUsername: string } | null;
}
interface ReviewResponse {
  data: ReviewItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<ReviewResponse>;

export default function DepotReviewPage() {
  const { data, isLoading, mutate } = useSWR("/api/admin/depot/review", fetcher, { refreshInterval: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setErr(null);
    try {
      const res = await fetch("/api/admin/depot/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Hata ${res.status}`);
      }
      // listeden çıkar (optimistik)
      await mutate(
        (cur) => (cur ? { ...cur, data: cur.data.filter((x) => x.id !== id) } : cur),
        { revalidate: false },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusy(null);
    }
  }

  if (isLoading || !data) return <p className="text-slate-400 text-sm">Yükleniyor…</p>;

  const items = data.data;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">İnceleme Kuyruğu</h1>
          <p className="text-sm text-slate-400 mt-1">
            Radar&apos;ın &quot;orta kanıt&quot; bulduğu ürünler. Onayla → depoya (dağıtılır), Reddet → bir daha eklenmez.
          </p>
        </div>
        <a href="/admin/radar" className="text-sm px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700">
          ← Radar paneli
        </a>
      </div>

      {err && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{err}</p>}

      {items.length === 0 ? (
        <p className="text-slate-500 text-sm p-6 text-center border border-slate-800 rounded-xl">
          İncelenecek ürün yok 🎉 (Radar otomatik kabul ettiklerini direkt depoya koydu.)
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="flex gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-900/60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {it.imageUrl ? (
                <img src={it.imageUrl} alt="" className="w-16 h-16 object-contain rounded-lg bg-white/5 shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-800 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{it.title ?? it.asin}</p>
                <p className="text-xs text-slate-500 font-mono">{it.asin}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                  <span>Amazon: ${it.amazonPrice?.toFixed(0) ?? "?"}</span>
                  <span>eBay (hesap): ${it.calculatedEbayPrice?.toFixed(0) ?? "?"}</span>
                  <span>Rakip: ${it.competitorPrice?.toFixed(0) ?? "?"}</span>
                  <span>Sold: {it.soldCount ?? "—"}</span>
                  <span className="text-emerald-400">Kâr: ${it.projectedProfit?.toFixed(1) ?? "?"}</span>
                  <span>Skor: {it.rankScore.toFixed(1)}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1 truncate">
                  Kaynak: {it.sourceStore?.ebayUsername ?? "?"} — &quot;{it.sourceKeyword ?? ""}&quot;
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => act(it.id, "approve")}
                  disabled={busy === it.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {busy === it.id ? "…" : "Onayla"}
                </button>
                <button
                  onClick={() => act(it.id, "reject")}
                  disabled={busy === it.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                >
                  {busy === it.id ? "…" : "Reddet"}
                </button>
                <a
                  href={`https://www.amazon.com/dp/${it.asin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-center text-slate-500 hover:text-slate-300"
                >
                  Amazon ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
