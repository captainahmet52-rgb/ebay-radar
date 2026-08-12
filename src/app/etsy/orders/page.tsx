"use client";

import { useState } from "react";
import { Search, RefreshCw } from "lucide-react";
import { EtsyReady, useEtsyData, PageHeader } from "@/components/etsy/shared";
import { cn } from "@/lib/utils";
import type { EtsyOrder, EtsyStore } from "@/types/etsyflow";

const STATUS_MAP: Record<string, { label: string; color: string; border: string; bg: string; icon: string }> = {
  new: { label: "Yeni Sipariş", color: "text-orange-400", border: "border-orange-400/30", bg: "bg-orange-400/10", icon: "🆕" },
  preparing: { label: "Hazırlanıyor", color: "text-emerald-400", border: "border-emerald-400/30", bg: "bg-emerald-400/10", icon: "⏳" },
  shipped: { label: "Kargoda", color: "text-purple-400", border: "border-purple-400/30", bg: "bg-purple-400/10", icon: "📦" },
  delivered: { label: "Teslim Edildi", color: "text-green-400", border: "border-green-400/30", bg: "bg-green-400/10", icon: "✅" },
  cancelled: { label: "İptal", color: "text-red-400", border: "border-red-400/30", bg: "bg-red-400/10", icon: "❌" },
};

function formatTotal(amount: number | null, currency: string) {
  if (!amount) return "—";
  const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
  return `${symbols[currency] ?? ""}${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`;
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function maskBuyer(name: string | null) {
  if (!name) return "—";
  return name.split(" ").map((p) => p.charAt(0) + "***").join(" ");
}

/** EtsyFlow'un kendi Orders.jsx'i (KODLAR/etsyflow-project) baz alındı — tedarikçi/kargo ödeme akışı hariç (bizde yok). */
export default function EtsyOrdersPage() {
  const { reload } = useEtsyData();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterStore, setFilterStore] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<(EtsyOrder & { _store?: EtsyStore }) | null>(null);

  return (
    <EtsyReady>
      {(data) => {
        const storeOf = (id: string) => data.stores.find((s) => s.id === id);

        const stats = {
          total: data.orders.length,
          new: data.orders.filter((o) => o.status === "new").length,
          preparing: data.orders.filter((o) => o.status === "preparing").length,
          shipped: data.orders.filter((o) => o.status === "shipped").length,
          delivered: data.orders.filter((o) => o.status === "delivered").length,
          cancelled: data.orders.filter((o) => o.status === "cancelled").length,
        };
        const totalRevenue = data.orders
          .filter((o) => o.status !== "cancelled")
          .reduce((s, o) => s + (o.total ?? 0), 0);

        const filtered = data.orders.filter((o) => {
          const matchesStatus = filterStatus === "all" || o.status === filterStatus;
          const matchesStore = filterStore === "all" || o.store_id === filterStore;
          const q = search.toLowerCase();
          const matchesSearch =
            !q ||
            (o.etsy_order_id ?? "").toLowerCase().includes(q) ||
            (o.buyer_name ?? "").toLowerCase().includes(q) ||
            (storeOf(o.store_id)?.name ?? "").toLowerCase().includes(q);
          return matchesStatus && matchesStore && matchesSearch;
        });

        return (
          <div>
            <PageHeader title="Siparişlerim" />

            {/* İstatistik Kartları */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
              <StatBox label="Toplam Sipariş" value={stats.total} valueCls="text-[#f8fafc]" sub="Tüm zamanlar" />
              <StatBox label="🆕 Yeni" value={stats.new} valueCls="text-orange-400" sub="İşlem bekliyor" />
              <StatBox label="⏳ Hazırlanıyor" value={stats.preparing} valueCls="text-emerald-400" sub="Üretimde" />
              <StatBox label="📦 Kargoda" value={stats.shipped} valueCls="text-purple-400" sub="Yolda" />
              <StatBox
                label="💰 Toplam Gelir"
                value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 0 })}`}
                valueCls="text-green-400"
                sub={`Teslim: ${stats.delivered}`}
              />
            </div>

            {/* Filtreler + Arama */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-between">
              <div className="flex gap-1.5 flex-wrap flex-1">
                {[
                  { key: "all", label: "📋 Tümü", count: stats.total },
                  { key: "new", label: "🆕 Yeni", count: stats.new },
                  { key: "preparing", label: "⏳ Hazırlanıyor", count: stats.preparing },
                  { key: "shipped", label: "📦 Kargoda", count: stats.shipped },
                  { key: "delivered", label: "✅ Teslim", count: stats.delivered },
                  { key: "cancelled", label: "❌ İptal", count: stats.cancelled },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilterStatus(f.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                      filterStatus === f.key
                        ? "bg-[#f1641e]/20 text-[#f1641e] border border-[#f1641e]/30"
                        : "bg-[#111827] text-[#94a3b8] border border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155]"
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-[#1e293b] rounded-full text-[10px] text-[#94a3b8]">{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Sipariş, alıcı, mağaza ara..."
                    className="bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-[#e2e8f0] placeholder-[#475569] focus:outline-none focus:border-[#f1641e]/50 w-[180px] pl-8 transition"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#475569]" />
                </div>

                <select
                  value={filterStore}
                  onChange={(e) => setFilterStore(e.target.value)}
                  className="bg-[#111827] border border-[#1e293b] rounded-lg pl-3 pr-8 py-1.5 text-xs text-[#e2e8f0] focus:outline-none focus:border-[#f1641e]/50 transition cursor-pointer"
                >
                  <option value="all">🏢 Tüm Mağazalar</option>
                  {data.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={reload}
                  className="px-3 py-1.5 rounded-lg text-xs text-[#94a3b8] hover:text-[#f1641e] border border-[#1e293b] hover:border-[#f1641e]/30 transition shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tablo */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-4xl mb-3">🛒</div>
                  <h3 className="text-[#e2e8f0] font-semibold mb-1">
                    {search ? "Aramanızla eşleşen sipariş yok" : filterStatus === "all" ? "Henüz sipariş yok" : "Bu durumda sipariş yok"}
                  </h3>
                  <p className="text-[#64748b] text-sm">
                    {filterStatus === "all" && !search ? "Chrome eklentisi siparişleri otomatik çekecek." : "Başka bir filtre deneyin."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        {["Sipariş No", "Mağaza", "Alıcı", "Tutar", "Durum", "Tarih"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748b] uppercase tracking-wider border-b border-[#1e293b] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o) => {
                        const st = STATUS_MAP[o.status] ?? STATUS_MAP.new;
                        const store = storeOf(o.store_id);
                        return (
                          <tr
                            key={o.id}
                            className="hover:bg-[#1e293b]/30 transition border-b border-[#1e293b]/40 last:border-0 cursor-pointer"
                            onClick={() => setSelected({ ...o, _store: store })}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-bold text-[#e2e8f0]">#{o.etsy_order_id || o.id.slice(0, 8).toUpperCase()}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-[#cbd5e1] truncate max-w-[130px]">{store?.name || "—"}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-[#94a3b8] whitespace-nowrap">{maskBuyer(o.buyer_name)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-sm font-bold text-[#f1641e]">{formatTotal(o.total, o.currency)}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border", st.color, st.border, st.bg)}>
                                {st.icon} {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-[#64748b]">{formatDateShort(o.created_at)}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!!filtered.length && (
              <div className="mt-3 text-xs text-[#475569] text-right">
                {filtered.length} / {data.orders.length} sipariş
              </div>
            )}

            {/* Detay Modal */}
            {selected && (
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={() => setSelected(null)}
              >
                <div
                  className="bg-[#0c1322] border border-[#1e293b] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-5 border-b border-[#1e293b]">
                    <div>
                      <h2 className="text-lg font-extrabold text-[#f8fafc]">
                        Sipariş #{selected.etsy_order_id || selected.id.slice(0, 8).toUpperCase()}
                      </h2>
                      <p className="text-xs text-[#64748b] mt-0.5">
                        {new Date(selected.created_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="w-8 h-8 rounded-lg bg-[#111827] border border-[#1e293b] text-[#94a3b8] hover:text-[#e2e8f0] transition flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="bg-[#111827] rounded-xl p-4 border border-[#1e293b]">
                      <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Mağaza</div>
                      <div className="text-sm font-semibold text-[#e2e8f0]">{selected._store?.name || "—"}</div>
                      <div className="text-xs text-[#64748b]">
                        {selected._store?.category} / {selected._store?.sub_category}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#111827] rounded-xl p-4 border border-[#1e293b]">
                        <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Alıcı</div>
                        <div className="text-sm text-[#e2e8f0] font-bold">{selected.buyer_name || "—"}</div>
                      </div>
                      <div className="bg-[#111827] rounded-xl p-4 border border-[#1e293b]">
                        <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-1">Tutar</div>
                        <div className="text-lg font-black text-[#f1641e]">{formatTotal(selected.total, selected.currency)}</div>
                      </div>
                    </div>

                    <div className="bg-[#111827] rounded-xl p-4 border border-[#1e293b]">
                      <div className="text-[10px] text-[#64748b] uppercase tracking-wider mb-2">Durum</div>
                      {(() => {
                        const st = STATUS_MAP[selected.status] ?? STATUS_MAP.new;
                        return (
                          <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full border inline-block", st.color, st.border, st.bg)}>
                            {st.icon} {st.label}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }}
    </EtsyReady>
  );
}

function StatBox({ label, value, valueCls, sub }: { label: string; value: string | number; valueCls: string; sub: string }) {
  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 hover:border-[#334155] transition">
      <div className="text-xs text-[#64748b] mb-1">{label}</div>
      <div className={cn("text-2xl font-black", valueCls)}>{value}</div>
      <div className="text-[10px] text-[#475569] mt-1">{sub}</div>
    </div>
  );
}
