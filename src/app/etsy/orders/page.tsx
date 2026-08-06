"use client";

import { useState } from "react";
import { Search, Package } from "lucide-react";
import { EtsyReady } from "@/components/etsy/shared";
import { Badge, ListflowHeader } from "@/components/etsy/ui";

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(s));
  } catch {
    return "—";
  }
}

const ORDER_STATUS: Record<string, { label: string; variant: "cyan" | "warning" | "purple" | "success" | "danger" | "muted" }> = {
  new: { label: "YENİ", variant: "cyan" },
  preparing: { label: "HAZIRLANIYOR", variant: "warning" },
  shipped: { label: "KARGODA", variant: "purple" },
  delivered: { label: "TESLİM EDİLDİ", variant: "success" },
  cancelled: { label: "İPTAL", variant: "danger" },
};

/** listflow.pro "Siparişlerim" sayfası — gerçek EtsyFlow siparişleri. */
export default function EtsyOrdersPage() {
  const [search, setSearch] = useState("");

  return (
    <EtsyReady>
      {(data) => {
        const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name ?? "—";
        const filtered = data.orders.filter((o) => {
          const q = search.toLowerCase();
          return (
            !q ||
            (o.buyer_name ?? "").toLowerCase().includes(q) ||
            (o.etsy_order_id ?? "").toLowerCase().includes(q) ||
            storeName(o.store_id).toLowerCase().includes(q)
          );
        });

        return (
          <div className="p-6 max-w-5xl mx-auto">
            <ListflowHeader
              eyebrow="SİPARİŞLER"
              title="Siparişlerim"
              subtitle="Mağazalarına gelen siparişleri takip et."
            />

            {/* Arama */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b80]" />
              <input
                type="text"
                placeholder="Sipariş, alıcı veya mağaza ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#6b6b80] focus:outline-none focus:border-[#8b5cf6] transition-all"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="border-2 border-dashed border-[#1e1e2e] rounded-xl py-20 px-6 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#1e1e2e] flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-[#6b6b80]" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">
                  {data.orders.length === 0 ? "Henüz siparişin bulunmuyor." : "Aramayla eşleşen sipariş yok."}
                </h3>
                <p className="text-sm text-[#6b6b80] max-w-sm">
                  Mağazalarına gelen siparişler burada görünecek. Ürünlerin Etsy&apos;ye yüklendikçe
                  satışlar buraya düşer.
                </p>
              </div>
            ) : (
              <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[#1e1e2e]">
                        {["SİPARİŞ", "MAĞAZA", "ALICI", "TARİH", "DURUM"].map((col) => (
                          <th
                            key={col}
                            className="px-4 py-3 text-left text-xs font-medium text-[#6b6b80] uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((o) => {
                        const cfg = ORDER_STATUS[o.status] ?? { label: o.status.toUpperCase(), variant: "muted" as const };
                        return (
                          <tr key={o.id} className="border-b border-[#1e1e2e] hover:bg-[#1e1e2e]/30 transition-colors">
                            <td className="px-4 py-3 text-sm font-medium text-white">
                              {o.etsy_order_id ?? o.id.slice(0, 8)}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#a0a0b0]">{storeName(o.store_id)}</td>
                            <td className="px-4 py-3 text-xs text-[#a0a0b0]">{o.buyer_name ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-[#a0a0b0]">{formatDate(o.created_at)}</td>
                            <td className="px-4 py-3">
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      }}
    </EtsyReady>
  );
}
