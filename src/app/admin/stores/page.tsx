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

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<TrackedStore[]>;

export default function AdminStoresPage() {
  const { data: stores, mutate, isLoading } = useSWR<TrackedStore[]>("/api/admin/stores", fetcher);
  const [username, setUsername] = useState("");
  const [storeUrl, setStoreUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [scanMsg, setScanMsg] = useState<Record<string, string>>({});

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebayUsername: username, storeUrl }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Hata olustu");
      } else {
        setUsername("");
        setStoreUrl("");
        void mutate();
      }
    } finally {
      setAdding(false);
    }
  };

  const handleScan = async (id: string) => {
    setScanMsg(prev => ({ ...prev, [id]: "Taranıyor..." }));
    try {
      const res = await fetch(`/api/admin/stores/${id}`, { method: "POST" });
      const data = (await res.json()) as { message?: string; error?: string };
      setScanMsg(prev => ({ ...prev, [id]: data.message ?? data.error ?? "Tamam" }));
    } catch {
      setScanMsg(prev => ({ ...prev, [id]: "Hata" }));
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
        <h2 className="font-semibold mb-4">Yeni Magaza Ekle</h2>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            placeholder="eBay Kullanici Adi"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-violet-500"
          />
          <input
            type="url"
            placeholder="Magaza URL (https://...)"
            value={storeUrl}
            onChange={e => setStoreUrl(e.target.value)}
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
                    <div className="flex items-center justify-end gap-2">
                      {scanMsg[store.id] && (
                        <span className="text-xs text-emerald-400">{scanMsg[store.id]}</span>
                      )}
                      <button
                        onClick={() => handleScan(store.id)}
                        className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-lg text-xs transition-colors"
                      >
                        Tara
                      </button>
                      <button
                        onClick={() => handleDelete(store.id)}
                        className="px-3 py-1 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg text-xs transition-colors"
                      >
                        Sil
                      </button>
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
