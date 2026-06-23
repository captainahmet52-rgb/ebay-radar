"use client";
import { useState } from "react";
import useSWR from "swr";

interface Coupon {
  id: string;
  code: string;
  rewardDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ data: Coupon[] }>;

export default function AdminCouponsPage() {
  const { data, mutate, isLoading } = useSWR("/api/admin/coupons", fetcher);
  const [code, setCode] = useState("");
  const [rewardDays, setRewardDays] = useState(7);
  const [maxUses, setMaxUses] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const coupons = data?.data ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          rewardDays,
          maxUses: maxUses ? Number(maxUses) : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? "Hata");
      else {
        setCode("");
        setMaxUses("");
        mutate();
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-1">Kuponlar</h1>
      <p className="text-sm text-slate-400 mb-5">
        İndirim/bonus gün kodları oluştur (sosyal medyada paylaş). Kullanan kullanıcıya bonus gün eklenir.
      </p>

      {/* Oluştur */}
      <form onSubmit={create} className="flex flex-wrap items-end gap-3 mb-6 p-4 rounded-xl bg-slate-900/60 border border-slate-700/50">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Kod</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ILK50"
            required
            className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Bonus Gün</label>
          <input
            type="number"
            value={rewardDays}
            onChange={(e) => setRewardDays(Number(e.target.value))}
            min={1}
            className="w-24 bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Max Kullanım (boş=∞)</label>
          <input
            type="number"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            min={1}
            placeholder="∞"
            className="w-28 bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
          />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          {adding ? "..." : "Oluştur"}
        </button>
        {error && <span className="text-red-400 text-sm w-full">{error}</span>}
      </form>

      {/* Liste */}
      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : coupons.length === 0 ? (
        <p className="text-slate-500 text-sm">Henüz kupon yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Kod</th>
                <th className="px-4 py-3 font-medium">Bonus Gün</th>
                <th className="px-4 py-3 font-medium">Kullanım</th>
                <th className="px-4 py-3 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-white">{c.code}</td>
                  <td className="px-4 py-3 text-emerald-400">+{c.rewardDays}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : " / ∞"}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">Aktif</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-500/15 text-slate-400">Pasif</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
