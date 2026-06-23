"use client";
import { useState } from "react";
import useSWR from "swr";

interface AffUser {
  id: string;
  email: string;
  isAffiliate: boolean;
  commissionRatePct: number;
  commissionBalanceUsd: number;
  _count: { referrals: number };
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ data: AffUser[] }>;

export default function AdminAffiliatesPage() {
  const [q, setQ] = useState("");
  const { data, mutate, isLoading } = useSWR(
    `/api/admin/affiliates${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    fetcher
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const users = data?.data ?? [];

  async function patch(userId: string, payload: Record<string, unknown>) {
    setBusyId(userId);
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...payload }),
      });
      if (res.ok) mutate();
      else alert((await res.json()).error ?? "Hata");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-1">Ortaklar (Affiliate)</h1>
      <p className="text-sm text-slate-400 mb-4">
        Kullanıcıyı ortak yap, komisyon oranını ayarla, bakiye ekle. Komisyonlar ödeme
        entegrasyonu gelince otomatik birikecek; şimdilik elle eklenir.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="E-posta ara (boş = sadece ortaklar)…"
        className="w-full mb-4 bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
      />

      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : users.length === 0 ? (
        <p className="text-slate-500 text-sm">Kayıt yok.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">E-posta</th>
                <th className="px-4 py-3 font-medium">Getirdiği</th>
                <th className="px-4 py-3 font-medium">Komisyon %</th>
                <th className="px-4 py-3 font-medium">Bakiye</th>
                <th className="px-4 py-3 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-slate-300">{u.email}</td>
                  <td className="px-4 py-3 text-slate-300">{u._count.referrals}</td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      defaultValue={u.commissionRatePct}
                      min={0}
                      max={90}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== u.commissionRatePct) patch(u.id, { commissionRatePct: v });
                      }}
                      className="w-16 bg-slate-800 border border-slate-700/50 rounded px-2 py-1 text-sm focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-3 text-emerald-400">${u.commissionBalanceUsd.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => patch(u.id, { isAffiliate: !u.isAffiliate })}
                      disabled={busyId === u.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 ${
                        u.isAffiliate
                          ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {u.isAffiliate ? "Ortaklığı Kaldır" : "Ortak Yap"}
                    </button>
                    <button
                      onClick={() => {
                        const v = prompt("Eklenecek bakiye ($):");
                        if (v && !Number.isNaN(Number(v))) patch(u.id, { addBalanceUsd: Number(v) });
                      }}
                      disabled={busyId === u.id}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                    >
                      + Bakiye
                    </button>
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
