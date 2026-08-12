"use client";

import { useMemo, useState } from "react";
import { Search, RotateCcw, X, Loader2, ImageOff } from "lucide-react";
import { EtsyReady, useEtsyData, PageHeader, Empty } from "@/components/etsy/shared";
import { cn } from "@/lib/utils";
import type { EtsyProduct, EtsyStore } from "@/types/etsyflow";

const uploadBadge: Record<string, { label: string; cls: string }> = {
  waiting: { label: "Bekliyor", cls: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  processing: { label: "İşleniyor", cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  uploading: { label: "Yükleniyor", cls: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  uploaded: { label: "Yüklendi", cls: "text-green-400 bg-green-400/10 border-green-400/30" },
  cancelled: { label: "İptal", cls: "text-[#64748b] bg-[#1e293b] border-[#334155]" },
};

type FilterKey = "all" | "waiting" | "uploaded" | "failed";

/** EtsyFlow'un kendi Products.jsx'i (KODLAR/etsyflow-project) baz alındı. */
export default function EtsyProductsPage() {
  const { reload } = useEtsyData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<EtsyProduct | null>(null);

  return (
    <EtsyReady>
      {(data) => {
        const storeOf = (id: string) => data.stores.find((s) => s.id === id);
        const failedCount = data.products.filter((p) => p.status === "error").length;

        const filtered = data.products.filter((p) => {
          const isFailed = p.status === "error";
          const isUploaded = p.upload_status === "uploaded" && !isFailed;
          const isWaiting = !isFailed && !isUploaded;
          const matchesFilter =
            filter === "all" ||
            (filter === "waiting" && isWaiting) ||
            (filter === "uploaded" && isUploaded) ||
            (filter === "failed" && isFailed);
          if (!matchesFilter) return false;
          const q = query.trim().toLowerCase();
          if (!q) return true;
          const store = storeOf(p.store_id);
          return `${p.title} ${store?.name ?? ""}`.toLowerCase().includes(q);
        });

        return (
          <div>
            <PageHeader title="Ürünlerim" />

            {failedCount > 0 && (
              <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-red-500/8 border border-red-500/25 rounded-xl">
                <span className="text-red-400 text-lg">⚠️</span>
                <div className="flex-1 text-sm text-red-400">
                  <strong>{failedCount}</strong> ürün hata verdi.
                  <span className="text-red-400/70 ml-1">&quot;Hatalı&quot; filtresinden bulup tekrar deneyebilirsin.</span>
                </div>
                <button
                  onClick={() => setFilter("failed")}
                  className="text-xs font-bold text-red-400 border border-red-400/30 px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition"
                >
                  Göster
                </button>
              </div>
            )}

            {/* Arama + Filtreler */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" />
                <input
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#0a0e1a] border border-[#1e293b] rounded-lg text-[#e2e8f0] text-sm outline-none focus:border-[#f1641e]/50 transition"
                  placeholder="Ürün ara..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                {(
                  [
                    ["all", "Tümü"],
                    ["waiting", "Bekleyenler"],
                    ["uploaded", "Yüklenenler"],
                    ["failed", `Hatalı${failedCount > 0 ? ` (${failedCount})` : ""}`],
                  ] as [FilterKey, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-semibold border transition",
                      filter === id
                        ? id === "failed"
                          ? "bg-red-400/15 text-red-300 border-red-400/40"
                          : "bg-[#f1641e]/15 text-[#ff8a50] border-[#f1641e]/40"
                        : "bg-[#0c1322] text-[#94a3b8] border-[#1e293b] hover:text-[#e2e8f0] hover:border-[#334155]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ürün Listesi */}
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
              {data.products.length === 0 ? (
                <Empty text="Henüz ürün yok." />
              ) : filtered.length === 0 ? (
                <Empty text="Filtreye uygun ürün bulunamadı." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      store={storeOf(p.store_id)}
                      onOpen={() => setSelected(p)}
                      onChanged={reload}
                    />
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <ProductDetailModal
                product={selected}
                store={storeOf(selected.store_id)}
                onClose={() => setSelected(null)}
                onChanged={() => {
                  reload();
                  setSelected(null);
                }}
              />
            )}
          </div>
        );
      }}
    </EtsyReady>
  );
}

function formatPrice(p: EtsyProduct) {
  if (p.price == null) return "—";
  const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[p.currency] ?? "";
  return `${sym}${Number(p.price).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${p.currency}`;
}

async function callProductApi(id: string, method: "PATCH" | "DELETE", body?: object) {
  const res = await fetch(`/api/etsy/products/${id}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "İşlem başarısız");
  }
}

function ProductCard({
  product,
  store,
  onOpen,
  onChanged,
}: {
  product: EtsyProduct;
  store: EtsyStore | undefined;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isFailed = product.status === "error";
  // "processing"/"uploading" sırasında eklenti üzerinde çalışıyor olabilir —
  // o anda requeue/sil butonlarını göstermiyoruz (yarış durumu, denetim 2026-08-06).
  const isInFlight = product.upload_status === "processing" || product.upload_status === "uploading";
  const isUploaded = product.upload_status === "uploaded" && !isFailed;
  const badge = isFailed
    ? { label: "Hata", cls: "text-red-400 bg-red-400/10 border-red-400/30" }
    : (uploadBadge[product.upload_status ?? ""] ?? uploadBadge.waiting);

  async function requeue() {
    setBusy(true);
    try {
      await callProductApi(product.id, "PATCH", { action: "requeue" });
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!window.confirm("Bu ürünü silmek istediğine emin misin?")) return;
    setBusy(true);
    try {
      await callProductApi(product.id, "DELETE");
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Hata");
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 group",
        isFailed
          ? "border-red-500/30 bg-red-500/5 hover:border-red-500/50"
          : "border-[#1e293b] bg-[#0c1322]/40 hover:border-[#f1641e]/30 hover:bg-[#111827]/60"
      )}
    >
      <button onClick={onOpen} className="aspect-[4/5] bg-[#1e293b] overflow-hidden relative border-b border-[#1e293b]/50 text-left">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#334155] gap-2">
            <ImageOff className="w-6 h-6" />
            <span className="text-[10px] uppercase font-black tracking-widest opacity-50">Görsel Yok</span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={cn("text-[10px] font-black px-2.5 py-1 rounded-lg border backdrop-blur-md", badge.cls)}>
            {badge.label}
          </span>
        </div>
      </button>

      <div className="p-4 flex flex-col flex-1">
        <div className="text-[13px] text-[#f1f5f9] font-bold leading-snug line-clamp-2 h-9 mb-2">
          {product.title || "Başlıksız ürün"}
        </div>

        <div className="flex items-center justify-between mb-4 mt-auto">
          <div className="flex flex-col">
            <span className="text-[9px] text-[#64748b] font-black uppercase tracking-tighter mb-0.5">Fiyat</span>
            <span className="text-sm font-black text-white">{formatPrice(product)}</span>
          </div>
          {store?.name && (
            <div className="text-right flex flex-col">
              <span className="text-[9px] text-[#64748b] font-black uppercase tracking-tighter mb-0.5">Mağaza</span>
              <span className="text-[11px] font-bold text-[#f1641e]/80">{store.name}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-auto">
          {busy ? (
            <div className="flex-1 flex items-center justify-center py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[#64748b]" />
            </div>
          ) : (
            <>
              {isFailed && (
                <button
                  onClick={requeue}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-yellow-500/10 border border-yellow-400/30 text-yellow-400 text-[11px] font-black rounded-xl hover:bg-yellow-400 hover:text-black transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> TEKRAR DENE
                </button>
              )}
              <button
                onClick={onOpen}
                className="flex-1 py-2.5 bg-[#1e293b] border border-[#334155] text-[#e2e8f0] text-[11px] font-black rounded-xl hover:bg-[#334155] transition-all uppercase tracking-widest"
              >
                Detaylar
              </button>
              {!isUploaded && !isInFlight && (
                <button
                  onClick={del}
                  className="py-2.5 px-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-black rounded-xl hover:bg-red-500/20 transition-all"
                  title="Sil"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal({
  product,
  store,
  onClose,
  onChanged,
}: {
  product: EtsyProduct;
  store: EtsyStore | undefined;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const images = useMemo(() => product.images ?? [], [product.images]);

  async function del() {
    if (!window.confirm("Bu ürünü silmek istediğine emin misin?")) return;
    setBusy(true);
    try {
      await callProductApi(product.id, "DELETE");
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Hata");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0e1a]/80 backdrop-blur-md" onClick={onClose} />
      <div className="bg-[#111827] border border-[#1e293b] w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden relative shadow-2xl flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 bg-[#1e293b] hover:bg-red-500/20 hover:text-red-400 rounded-full flex items-center justify-center transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col lg:flex-row h-full overflow-hidden">
          <div className="w-full lg:w-1/2 bg-[#0a0e1a] border-r border-[#1e293b] overflow-y-auto p-6">
            <div className="space-y-4">
              {images.length === 0 ? (
                <div className="aspect-square rounded-2xl border border-[#1e293b] flex items-center justify-center text-[#334155]">
                  <ImageOff className="w-8 h-8" />
                </div>
              ) : (
                images.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} className="w-full rounded-2xl border border-[#1e293b] shadow-lg" alt={`Görsel ${i + 1}`} />
                ))
              )}
            </div>
          </div>

          <div className="w-full lg:w-1/2 p-8 overflow-y-auto">
            <div className="mb-6">
              <div className="text-[10px] text-[#f1641e] font-black uppercase tracking-[0.2em] mb-2">Ürün Detayları</div>
              <h2 className="text-xl font-black text-white leading-tight mb-4">{product.title}</h2>
              <div className="flex items-center gap-4">
                <div className="bg-[#f1641e]/10 border border-[#f1641e]/20 px-4 py-2 rounded-2xl">
                  <div className="text-[9px] text-[#f1641e] font-black uppercase tracking-tighter">Fiyat</div>
                  <div className="text-lg font-black text-white">{formatPrice(product)}</div>
                </div>
                {store?.name && (
                  <div className="bg-[#1e293b] border border-[#334155] px-4 py-2 rounded-2xl">
                    <div className="text-[9px] text-[#64748b] font-black uppercase tracking-tighter">Mağaza</div>
                    <div className="text-sm font-bold text-[#f1f5f9]">{store.name}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="text-[10px] text-[#64748b] font-black uppercase tracking-widest mb-3 border-b border-[#1e293b] pb-2">
                  Açıklama
                </div>
                <div className="text-sm text-[#cbd5e1] leading-relaxed whitespace-pre-wrap">
                  {product.description || "Bu ürün için açıklama bulunmuyor."}
                </div>
              </div>

              {product.tags && product.tags.length > 0 && (
                <div>
                  <div className="text-[10px] text-[#64748b] font-black uppercase tracking-widest mb-3">Etiketler</div>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((t) => (
                      <span key={t} className="px-3 py-1 bg-[#1e293b] text-[#94a3b8] text-[10px] font-bold rounded-lg border border-[#334155]">
                        #{t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-[#1e293b]">
                  <div className="text-[9px] text-[#64748b] font-black uppercase">SKU / ID</div>
                  <div className="text-xs font-mono text-[#94a3b8] mt-1 truncate">{product.id}</div>
                </div>
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-[#1e293b]">
                  <div className="text-[9px] text-[#64748b] font-black uppercase">Kategori</div>
                  <div className="text-xs font-bold text-[#94a3b8] mt-1">{product.category ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex gap-3">
              {product.etsy_listing_id && (
                <a
                  href={`https://www.etsy.com/listing/${product.etsy_listing_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-4 bg-[#f1641e] text-[#0a0e1a] text-center text-xs font-black rounded-2xl hover:bg-[#ff8a50] transition-all"
                >
                  Etsy&apos;de Görüntüle ↗
                </a>
              )}
              <button
                onClick={del}
                disabled={busy}
                className="py-4 px-5 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-black rounded-2xl hover:bg-red-500/20 transition-all disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sil"}
              </button>
              <button
                onClick={onClose}
                className="py-4 px-5 bg-[#1e293b] text-[#cbd5e1] text-xs font-black rounded-2xl hover:bg-[#334155] transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
