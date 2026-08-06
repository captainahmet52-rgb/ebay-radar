"use client";

import { useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Package, RotateCcw, Ban, Trash2, Loader2 } from "lucide-react";
import { EtsyReady, useEtsyData } from "@/components/etsy/shared";
import { Badge, ListflowHeader } from "@/components/etsy/ui";
import { cn } from "@/lib/utils";
import type { EtsyProduct } from "@/types/etsyflow";

const PAGE_SIZE = 12;

/** Eklenti kuyruğu durum etiketleri (products.upload_status). */
const UPLOAD_STATUS: Record<string, { label: string; variant: "success" | "warning" | "cyan" | "danger" | "muted" }> = {
  waiting: { label: "KUYRUKTA", variant: "warning" },
  processing: { label: "İŞLENİYOR", variant: "cyan" },
  uploading: { label: "YÜKLENİYOR", variant: "cyan" },
  uploaded: { label: "ETSY'DE", variant: "success" },
  cancelled: { label: "İPTAL", variant: "danger" },
};

type StatusFilter = "all" | "waiting" | "uploaded" | "cancelled";

/** listflow.pro "Ürünler" sayfası — gerçek üretim + yükleme kuyruğu yönetimi. */
export default function EtsyProductsPage() {
  const { reload } = useEtsyData();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  return (
    <EtsyReady>
      {(data) => {
        const products = data.products;
        const storeName = (id: string) => data.stores.find((s) => s.id === id)?.name ?? "—";

        const filtered = products.filter((p) => {
          const q = search.toLowerCase();
          const matchSearch =
            !q ||
            p.title.toLowerCase().includes(q) ||
            (p.category ?? "").toLowerCase().includes(q) ||
            storeName(p.store_id).toLowerCase().includes(q);
          const matchStatus =
            statusFilter === "all" || (p.upload_status ?? "") === statusFilter;
          return matchSearch && matchStatus;
        });

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        const safePage = Math.min(page, totalPages);
        const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

        const waiting = products.filter((p) => p.upload_status === "waiting").length;
        const uploaded = products.filter((p) => p.upload_status === "uploaded").length;
        const cancelled = products.filter((p) => p.upload_status === "cancelled").length;

        return (
          <div className="p-6 max-w-7xl mx-auto">
            <ListflowHeader
              eyebrow="ÜRÜN YÖNETİMİ"
              title="Ürünler"
              subtitle="Otomasyonun ürettiği tüm ürünler ve eklenti yükleme kuyruğu."
            />

            {/* İstatistik şeridi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Toplam", value: products.length, color: "text-white" },
                { label: "Kuyrukta", value: waiting, color: "text-yellow-400" },
                { label: "Etsy'de", value: uploaded, color: "text-[#10b981]" },
                { label: "İptal", value: cancelled, color: "text-red-400" },
              ].map((stat) => (
                <div key={stat.label} className="bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-3">
                  <div className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">{stat.label}</div>
                  <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Filtreler */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b80]" />
                <input
                  type="text"
                  placeholder="Ürün, kategori veya mağaza ara..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-[#12121a] border border-[#1e1e2e] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#6b6b80] focus:outline-none focus:border-[#8b5cf6] transition-all"
                />
              </div>
              <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
                {(
                  [
                    ["all", "Tümü"],
                    ["waiting", "Kuyrukta"],
                    ["uploaded", "Etsy'de"],
                    ["cancelled", "İptal"],
                  ] as [StatusFilter, string][]
                ).map(([f, label]) => (
                  <button
                    key={f}
                    onClick={() => {
                      setStatusFilter(f);
                      setPage(1);
                    }}
                    className={cn(
                      "px-4 py-2.5 text-xs font-medium transition-all border-r border-[#1e1e2e] last:border-r-0",
                      statusFilter === f
                        ? "bg-[#8b5cf6] text-white"
                        : "bg-[#12121a] text-[#6b6b80] hover:text-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tablo */}
            <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      {["ÜRÜN", "MAĞAZA", "KATEGORİ", "FİYAT", "KUYRUK", "İŞLEM"].map((col) => (
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
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-[#6b6b80] text-sm">
                          Ürün bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      paginated.map((p) => (
                        <ProductRow
                          key={p.id}
                          product={p}
                          storeName={storeName(p.store_id)}
                          onChanged={reload}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e2e]">
                  <span className="text-xs text-[#6b6b80]">
                    {filtered.length} üründen {(safePage - 1) * PAGE_SIZE + 1}-
                    {Math.min(safePage * PAGE_SIZE, filtered.length)} gösteriliyor
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="p-1.5 rounded-md border border-[#1e1e2e] text-[#6b6b80] hover:text-white hover:border-[#8b5cf6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-white px-2">
                      {safePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="p-1.5 rounded-md border border-[#1e1e2e] text-[#6b6b80] hover:text-white hover:border-[#8b5cf6] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    </EtsyReady>
  );
}

// ─── Tablo satırı ───────────────────────────────────────────────────────────

function ProductRow({
  product,
  storeName,
  onChanged,
}: {
  product: EtsyProduct;
  storeName: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const status = UPLOAD_STATUS[product.upload_status ?? ""] ?? { label: "—", variant: "muted" as const };
  const isUploaded = product.upload_status === "uploaded";
  const isWaiting = product.upload_status === "waiting";

  async function act(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    try {
      const res = await fetch(`/api/etsy/products/${product.id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        window.alert(j.error ?? "İşlem başarısız");
        setBusy(false);
        return;
      }
      onChanged();
    } catch {
      window.alert("Bağlantı hatası");
      setBusy(false);
    }
  }

  return (
    <tr className="border-b border-[#1e1e2e] hover:bg-[#1e1e2e]/30 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 max-w-md">
          {product.images?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.images[0]}
              alt=""
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-[#1e1e2e]"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#0a0a0f] border border-[#1e1e2e] flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-[#6b6b80]" />
            </div>
          )}
          <span className="text-sm font-medium text-white truncate">{product.title}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[#a0a0b0] whitespace-nowrap">{storeName}</td>
      <td className="px-4 py-3 text-xs text-[#a0a0b0] whitespace-nowrap">
        {product.category ?? "—"}
        {product.sub_category ? ` · ${product.sub_category}` : ""}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">
        {product.price != null
          ? `${product.currency === "TRY" ? "₺" : "$"}${Number(product.price).toFixed(2)}`
          : "—"}
      </td>
      <td className="px-4 py-3">
        <Badge variant={status.variant}>{status.label}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#6b6b80]" />
          ) : (
            <>
              {isWaiting && (
                <RowAction
                  title="Kuyruktan çıkar"
                  onClick={() => act("PATCH", { action: "cancel" })}
                  icon={Ban}
                  hover="hover:text-yellow-400 hover:border-yellow-400/50"
                />
              )}
              {!isWaiting && !isUploaded && (
                <RowAction
                  title="Tekrar kuyruğa al"
                  onClick={() => act("PATCH", { action: "requeue" })}
                  icon={RotateCcw}
                  hover="hover:text-[#06b6d4] hover:border-[#06b6d4]/50"
                />
              )}
              {!isUploaded && (
                <RowAction
                  title="Ürünü sil"
                  onClick={() => {
                    if (window.confirm("Bu ürünü kalıcı olarak silmek istediğine emin misin?")) {
                      void act("DELETE");
                    }
                  }}
                  icon={Trash2}
                  hover="hover:text-red-400 hover:border-red-400/50"
                />
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function RowAction({
  title,
  onClick,
  icon: Icon,
  hover,
}: {
  title: string;
  onClick: () => void;
  icon: React.ElementType;
  hover: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md border border-[#1e1e2e] text-[#6b6b80] transition-all",
        hover
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
