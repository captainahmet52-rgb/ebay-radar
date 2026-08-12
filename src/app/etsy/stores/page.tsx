"use client";

import { useState } from "react";
import { Trash2, Copy, Check, Loader2 } from "lucide-react";
import { EtsyReady, useEtsyData, PageHeader, Empty } from "@/components/etsy/shared";
import { ETSY_CATALOG, ETSY_CURRENCIES, findCatalogCategory } from "@/lib/etsy-catalog";
import type { EtsyStore } from "@/types/etsyflow";

/** EtsyFlow'un kendi Stores.jsx'i (KODLAR/etsyflow-project) baz alındı — ödeme/Pinterest/özel ürün modalları hariç. */
export default function EtsyStoresPage() {
  const { reload } = useEtsyData();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [currency, setCurrency] = useState<(typeof ETSY_CURRENCIES)[number]>("TRY");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const subCategories = findCatalogCategory(category)?.subCategories ?? [];
  const inputCls =
    "w-full px-3.5 py-2.5 bg-[#0c0a09] border border-[#292524] rounded-lg text-[#d6d3d1] text-sm outline-none focus:border-[#f1641e]/50 transition";

  async function handleSave() {
    if (!name.trim()) return setMessage({ type: "error", text: "Mağaza adı boş olamaz." });
    if (!category) return setMessage({ type: "error", text: "Kategori seçmelisiniz." });
    if (!subCategory) return setMessage({ type: "error", text: "Alt kategori seçmelisiniz." });

    setSaving(true);
    try {
      const res = await fetch("/api/etsy/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category, sub_category: subCategory, currency }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Eklenemedi");
      }
      setName("");
      setCategory("");
      setSubCategory("");
      setCurrency("TRY");
      setShowForm(false);
      setMessage({ type: "success", text: `"${name.trim()}" eklendi. Otomasyon ilk denetimde üretime başlayacak.` });
      reload();
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Eklenemedi" });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 5000);
    }
  }

  return (
    <EtsyReady>
      {(data) => (
        <div>
          <PageHeader title="Mağazalarım" />

          {message && (
            <div
              className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                message.type === "success"
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-red-500/10 border border-red-500/30 text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            className="bg-gradient-to-r from-[#f1641e] to-[#d65212] text-[#0c0a09] px-5 py-2.5 rounded-xl text-sm font-bold mb-5 hover:opacity-90 transition"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "✕ Kapat" : "+ Mağaza Ekle"}
          </button>

          {showForm && (
            <div className="bg-[#1c1917] border border-[#292524] rounded-xl p-5 mb-5">
              <h3 className="text-sm font-bold text-[#f5f5f4] mb-4">Yeni Mağaza Ekle</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#a8a29e] mb-1.5">Mağaza İsmi *</label>
                  <input className={inputCls} placeholder="Mağaza adı" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a8a29e] mb-1.5">Kategori *</label>
                  <select
                    className={inputCls + " cursor-pointer"}
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setSubCategory("");
                    }}
                  >
                    <option value="">Kategori Seçin</option>
                    {ETSY_CATALOG.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a8a29e] mb-1.5">Alt Kategori *</label>
                  <select
                    className={inputCls + " cursor-pointer disabled:opacity-50"}
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    disabled={!category}
                  >
                    <option value="">Alt Kategori Seçin</option>
                    {subCategories.map((sc) => (
                      <option key={sc} value={sc}>
                        {sc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#a8a29e] mb-1.5">Para Birimi</label>
                  <select
                    className={inputCls + " cursor-pointer"}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as (typeof ETSY_CURRENCIES)[number])}
                  >
                    {ETSY_CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c === "TRY" ? "TRY (₺)" : "USD ($)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                className="bg-gradient-to-r from-[#f1641e] to-[#d65212] text-[#0c0a09] px-5 py-2.5 rounded-xl text-sm font-bold mt-4 hover:opacity-90 transition disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Kaydediliyor..." : "Mağazayı Kaydet"}
              </button>
            </div>
          )}

          {data.stores.length === 0 ? (
            <Empty text="Henüz mağaza yok." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.stores.map((store) => (
                <StoreCard
                  key={store.id}
                  store={store}
                  productCount={data.products.filter((p) => p.store_id === store.id).length}
                  onChanged={reload}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </EtsyReady>
  );
}

const statusColors: Record<string, string> = {
  active: "text-green-400 border-green-400/30",
  inactive: "text-[#a8a29e] border-[#44403c]",
  paused: "text-yellow-400 border-yellow-400/30",
};

function StoreCard({
  store,
  productCount,
  onChanged,
}: {
  store: EtsyStore;
  productCount: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const isActive = store.status === "active";

  async function toggleStatus() {
    setBusy(true);
    try {
      const res = await fetch(`/api/etsy/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: isActive ? "inactive" : "active" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "İşlem başarısız");
      }
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`"${store.name}" mağazasını silmek istediğine emin misin?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/etsy/stores/${store.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Silinemedi");
      }
      onChanged();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Silinemedi");
      setBusy(false);
    }
  }

  function copyClientId() {
    if (!store.client_id) return;
    navigator.clipboard.writeText(store.client_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const icon = findCatalogCategory(store.category ?? "")?.icon ?? "🛍️";

  return (
    <div className="bg-[#1c1917] border border-[#292524] rounded-xl p-5">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-[#f5f5f4] flex items-center gap-2">
          <span>{icon}</span> {store.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusColors[store.status] ?? statusColors.active}`}>
            {store.status === "active" ? "Aktif" : store.status === "paused" ? "Durduruldu" : "Pasif"}
          </span>
          <button
            onClick={remove}
            disabled={busy}
            className="p-1.5 rounded-lg text-xs border text-red-400 border-red-400/30 hover:bg-red-400/10 transition disabled:opacity-50"
            title="Mağazayı Sil"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="text-xs text-[#78716c] mb-3">
        {store.category ?? "—"}
        {store.sub_category ? ` · ${store.sub_category}` : ""} · {store.currency}
      </div>

      {store.client_id ? (
        <div className="bg-[#0c0a09] border border-[#f1641e]/20 rounded-xl p-3 mb-3">
          <div className="text-[10px] font-semibold text-[#78716c] uppercase tracking-wider mb-1">Client ID</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-black font-mono text-[#f1641e] tracking-widest">{store.client_id}</span>
            <button
              onClick={copyClientId}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                copied ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-[#a8a29e] border-[#44403c] hover:text-[#f1641e] hover:border-[#f1641e]/30"
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <div className="text-[10px] text-[#57534e] mt-1.5 text-center">Chrome eklentisine bu ID&apos;yi girin</div>
        </div>
      ) : (
        <div className="bg-[#0c0a09] border border-[#292524] rounded-xl p-3 mb-3 text-xs text-[#78716c] text-center">
          Client ID atanıyor...
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[#292524]">
        <div className="text-xs text-[#78716c]">
          Üretilen ürün: <span className="font-bold text-[#d6d3d1]">{productCount}</span>
        </div>
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#292524] text-[#a8a29e] hover:text-[#d6d3d1] hover:border-[#44403c] transition disabled:opacity-50"
        >
          {isActive ? "Durdur" : "Başlat"}
        </button>
      </div>
    </div>
  );
}
