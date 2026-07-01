"use client";
import { useState } from "react";
import useSWR from "swr";

interface TrackedStore {
  id: string;
  ebayUsername: string;
  storeUrl: string;
  isActive: boolean;
  lastScannedAt: string | null;
  createdAt: string;
  _count: { depotProducts: number };
}

interface ScanProgress {
  state: string; // starting | waiting | active | completed | failed | unknown
  phase?: string; // fetching | sold | matching | done
  processed: number;
  total: number;
  accepted?: number;
  review?: number;
  skipped?: number;
  cached?: number;
  note?: string; // done: 0 ürün sebebi / hata
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<TrackedStore[]>;

export default function AdminStoresPage() {
  const { data: stores, mutate, isLoading } = useSWR<TrackedStore[]>("/api/admin/stores", fetcher);
  const [username, setUsername] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scan, setScan] = useState<Record<string, ScanProgress>>({});

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerInput: username }),
      });
      const data = (await res.json()) as {
        error?: string;
        resolvedUsername?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Hata olustu");
      } else {
        if (data.resolvedUsername) {
          setNotice(`Mağaza eklendi: ${data.resolvedUsername}`);
        }
        setUsername("");
        void mutate();
      }
    } finally {
      setAdding(false);
    }
  };

  const pollStatus = async (storeId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/admin/radar/scan-status?jobId=${encodeURIComponent(jobId)}`);
      const data = (await res.json()) as { state: string; progress: ScanProgress | null };
      const p = data.progress;
      setScan(prev => {
        const cur = prev[storeId] ?? { state: "", processed: 0, total: 0 };
        return {
          ...prev,
          [storeId]: {
            state: data.state,
            phase: p?.phase ?? cur.phase,
            processed: p?.processed ?? cur.processed,
            total: p?.total ?? cur.total,
            accepted: p?.accepted ?? cur.accepted,
            review: p?.review ?? cur.review,
            skipped: p?.skipped ?? cur.skipped,
            cached: p?.cached ?? cur.cached,
            note: p?.note ?? cur.note,
          },
        };
      });
      if (data.state === "completed" || data.state === "failed" || data.state === "unknown") {
        void mutate(); // depo sayısı + son tarama güncellensin
        return;
      }
    } catch {
      /* geçici hata → yine dene */
    }
    setTimeout(() => pollStatus(storeId, jobId), 2000);
  };

  const handleScan = async (id: string) => {
    setScan(prev => ({ ...prev, [id]: { state: "starting", processed: 0, total: 0 } }));
    try {
      const res = await fetch(`/api/admin/stores/${id}`, { method: "POST" });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (data.jobId) {
        pollStatus(id, data.jobId);
      } else {
        setScan(prev => ({ ...prev, [id]: { state: "failed", processed: 0, total: 0 } }));
      }
    } catch {
      setScan(prev => ({ ...prev, [id]: { state: "failed", processed: 0, total: 0 } }));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu mağazayı silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/admin/stores/${id}`, { method: "DELETE" });
    void mutate();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Takip Edilen Magazalar</h1>

      {/* Ekleme formu */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-6 mb-8">
        <h2 className="font-semibold mb-1">Yeni Magaza Ekle</h2>
        <p className="text-xs text-slate-400 mb-4">
          Takip etmek istediğin <strong>eBay mağaza linkini</strong> yapıştır — hepsi bu.
          Örn: <span className="text-slate-300">https://www.ebay.com/str/telitetech</span>
        </p>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="https://www.ebay.com/str/magaza-adi"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={adding}
            className="px-5 py-2 bg-violet-600 hover:bg-violet-500 rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {adding ? "Ekleniyor..." : "Ekle"}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {notice && <p className="text-emerald-400 text-sm mt-2">✓ {notice}</p>}
      </div>

      {/* Mağaza listesi */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Yukleniyor...</div>
        ) : !stores?.length ? (
          <div className="p-8 text-center text-slate-400">Henuz magaza eklenmedi.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 text-slate-400">
                <th className="text-left p-4">Kullanici Adi</th>
                <th className="text-left p-4">Depo Urunu</th>
                <th className="text-left p-4">Son Tarama</th>
                <th className="text-left p-4">Durum</th>
                <th className="text-right p-4">Islemler</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <tr key={store.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="p-4 font-medium text-violet-300">{store.ebayUsername}</td>
                  <td className="p-4 text-slate-300">{store._count.depotProducts} urun</td>
                  <td className="p-4 text-slate-400">
                    {store.lastScannedAt
                      ? new Date(store.lastScannedAt).toLocaleString("tr-TR")
                      : "Hic taranmadi"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        store.isActive
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-slate-600/30 text-slate-400"
                      }`}
                    >
                      {store.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleScan(store.id)}
                          disabled={isScanning(scan[store.id])}
                          className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-xs transition-colors disabled:opacity-50"
                        >
                          {isScanning(scan[store.id]) ? "Taranıyor…" : "Tara"}
                        </button>
                        <button
                          onClick={() => handleDelete(store.id)}
                          className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg text-xs transition-colors"
                        >
                          Sil
                        </button>
                      </div>
                      <ScanIndicator s={scan[store.id]} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function isScanning(s?: ScanProgress): boolean {
  if (!s) return false;
  return !(s.state === "completed" || s.state === "failed" || s.state === "unknown" || s.phase === "done");
}

function ScanIndicator({ s }: { s?: ScanProgress }) {
  if (!s) return null;
  const done = s.state === "completed" || s.state === "unknown" || s.phase === "done";
  if (s.state === "failed") return <p className="text-xs text-red-400">✗ Tarama hatası</p>;

  if (done) {
    // 0 ürün / hata durumunda sebebi göster (kör kalma)
    if (s.note) {
      return <p className="text-xs text-amber-400 max-w-xs">⚠ {s.note}</p>;
    }
    return (
      <p className="text-xs text-emerald-400">
        ✓ Bitti — kabul {s.accepted ?? 0}, inceleme {s.review ?? 0}, atla {s.skipped ?? 0}
      </p>
    );
  }

  if (s.phase === "matching" && s.total > 0) {
    const pct = Math.min(100, Math.round((s.processed / s.total) * 100));
    return (
      <div className="w-56">
        <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-blue-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {s.processed}/{s.total} işlendi (%{pct}) · kabul {s.accepted ?? 0} · atla {s.skipped ?? 0}
        </p>
      </div>
    );
  }

  if (s.phase === "sold") {
    return (
      <p className="text-xs text-slate-400 flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 border-2 border-slate-600 border-t-amber-400 rounded-full animate-spin" />
        satış verileri çekiliyor… {s.total > 0 ? `${s.processed}/${s.total}` : ""}
      </p>
    );
  }

  return (
    <p className="text-xs text-slate-400 flex items-center gap-1.5">
      <span className="inline-block w-3 h-3 border-2 border-slate-600 border-t-violet-400 rounded-full animate-spin" />
      {s.phase === "fetching" ? "eBay ilanları çekiliyor…" : "Başlatılıyor…"}
    </p>
  );
}
