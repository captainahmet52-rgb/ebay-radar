"use client";
import { useState } from "react";
import useSWR from "swr";
import { PLAN_LIST, PRO_PLUS_PLANS, type PlanId } from "@/lib/plans";

interface UserStore {
  id: string;
  ebayUserId: string;
  marketplace: string;
  isActive: boolean;
  activatedAt: string | null;
  createdAt: string;
  plan: string;
  productLimit: number;
  user: { id: string; email: string; plan: string };
}

// Aktifleştir/paket değiştir dropdown'unda gösterilen seçenekler (ana grid + Pro+).
const PLAN_OPTIONS = [...PLAN_LIST, ...PRO_PLUS_PLANS];

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ data: UserStore[] }>;

function marketLabel(m: string): string {
  const map: Record<string, string> = {
    EBAY_US: "🇺🇸 US", EBAY_GB: "🇬🇧 UK", EBAY_DE: "🇩🇪 DE",
  };
  return map[m] ?? m.replace("EBAY_", "");
}

export default function AdminUserStoresPage() {
  const { data, mutate, isLoading } = useSWR("/api/admin/user-stores", fetcher);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  // Satır başına seçili paket — dropdown'da değiştirilince burada tutulur,
  // sunucudan yeni veri gelince (mutate) hâlâ boşsa mağazanın gerçek planına düşer.
  const [selectedPlan, setSelectedPlan] = useState<Record<string, PlanId>>({});

  const stores = data?.data ?? [];
  const filtered = q
    ? stores.filter(
        (s) =>
          s.user.email.toLowerCase().includes(q.toLowerCase()) ||
          s.ebayUserId.toLowerCase().includes(q.toLowerCase())
      )
    : stores;

  function planFor(s: UserStore): PlanId {
    return selectedPlan[s.id] ?? (s.plan as PlanId);
  }

  async function patch(id: string, isActive: boolean, plan: PlanId) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/user-stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id, isActive, plan }),
      });
      if (res.ok) mutate();
      else {
        const j = await res.json();
        alert(j.error ?? "Hata");
      }
    } finally {
      setBusyId(null);
    }
  }

  function toggle(s: UserStore) {
    return patch(s.id, !s.isActive, planFor(s));
  }

  function changePlan(s: UserStore, plan: PlanId) {
    setSelectedPlan((prev) => ({ ...prev, [s.id]: plan }));
    // Zaten aktif bir mağazanın paketini hemen uygula (upgrade/downgrade).
    // Henüz aktif değilse sadece seçimi hatırla — Aktifleştir'e basınca uygulanır.
    if (s.isActive) void patch(s.id, true, plan);
  }

  const activeCount = stores.filter((s) => s.isActive).length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold mb-1">Müşteri Mağazaları</h1>
      <p className="text-sm text-slate-400 mb-4">
        Kullanıcı eBay mağazalarını ödemesiz aktifleştir/pasifleştir, hangi paketi
        kullanacağını seç (patron yetkisi — plan limiti yok; IBAN'dan ödeme alınan
        müşteriler için buradan paket ata).
      </p>

      <div className="flex items-center gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="E-posta veya eBay kullanıcı adı ara…"
          className="flex-1 bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        <span className="text-sm text-slate-400">
          Aktif: <span className="text-emerald-400 font-bold">{activeCount}</span> / {stores.length}
        </span>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">Mağaza bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/60 text-slate-400 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Kullanıcı</th>
                <th className="px-4 py-3 font-medium">eBay Mağaza</th>
                <th className="px-4 py-3 font-medium">Pazar</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Durum</th>
                <th className="px-4 py-3 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-slate-300">{s.user.email}</td>
                  <td className="px-4 py-3 text-white font-medium">{s.ebayUserId}</td>
                  <td className="px-4 py-3 text-slate-400">{marketLabel(s.marketplace)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={planFor(s)}
                      onChange={(e) => changePlan(s, e.target.value as PlanId)}
                      disabled={busyId === s.id}
                      className="bg-slate-800 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50"
                    >
                      {PLAN_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.productLimit.toLocaleString("tr-TR")} ürün)
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {s.isActive ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">
                        Aktif
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-500/15 text-slate-400">
                        Pasif
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(s)}
                      disabled={busyId === s.id}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        s.isActive
                          ? "bg-slate-700 hover:bg-slate-600 text-slate-200"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      }`}
                    >
                      {busyId === s.id ? "…" : s.isActive ? "Pasifleştir" : "Aktifleştir"}
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
