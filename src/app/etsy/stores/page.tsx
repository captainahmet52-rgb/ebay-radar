"use client";

import { useState } from "react";
import { Plus, Package, ShoppingBag, Info, X, Power, Loader2 } from "lucide-react";
import { EtsyReady, useEtsyData } from "@/components/etsy/shared";
import { Badge, Button, Input, Modal, Select, ListflowHeader } from "@/components/etsy/ui";
import { ETSY_CATALOG, ETSY_CURRENCIES, findCatalogCategory } from "@/lib/etsy-catalog";
import type { EtsyStore } from "@/types/etsyflow";

/** listflow.pro "Etsy Otomasyon → Mağaza Yönetimi" sayfası — gerçek CRUD. */
export default function EtsyStoresPage() {
  const { reload } = useEtsyData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <EtsyReady>
      {(data) => (
        <div className="p-6 max-w-7xl mx-auto">
          <ListflowHeader
            eyebrow="ETSY OTOMASYON"
            title="Mağaza Yönetimi"
            subtitle="Mağazanı ekle, otomasyon dakikalar içinde üretime başlasın."
            right={
              <Button variant="primary" onClick={() => setIsModalOpen(true)} className="flex-shrink-0">
                <Plus className="w-4 h-4" />
                YENİ MAĞAZA EKLE
              </Button>
            }
          />

          {/* Bilgi şeridi */}
          <div className="flex flex-wrap gap-4 mb-8">
            <div className="flex items-center gap-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-xs text-[#6b6b80]">OTOMASYON:</span>
              <span className="text-xs font-medium text-[#10b981]">
                {data.stores.filter((s) => s.status === "active").length} mağazada aktif
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#12121a] border border-[#1e1e2e] rounded-lg px-4 py-2.5">
              <Package className="w-3.5 h-3.5 text-[#6b6b80]" />
              <span className="text-xs text-[#6b6b80]">ÜRÜNLER:</span>
              <span className="text-xs font-medium text-white">{data.products.length}</span>
              <span className="text-xs text-[#6b6b80]">Toplam üretim</span>
            </div>
          </div>

          {/* Mağaza gridi */}
          <h2 className="text-sm font-semibold text-[#a0a0b0] uppercase tracking-wider mb-4">
            MAĞAZALARIM
          </h2>
          {data.stores.length === 0 ? (
            <div className="border-2 border-dashed border-[#1e1e2e] rounded-xl py-16 px-6 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-[#1e1e2e] flex items-center justify-center mb-4">
                <Package className="w-7 h-7 text-[#6b6b80]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">Henüz mağaza eklenmedi.</h3>
              <p className="text-sm text-[#6b6b80] max-w-sm mb-6">
                İlk mağazanı ekle — kategorisini seç, otomasyon senin yerine üretsin.
              </p>
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4" />
                İlk Mağazanı Ekle
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

          <AddStoreModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={() => {
              setIsModalOpen(false);
              reload();
            }}
          />
        </div>
      )}
    </EtsyReady>
  );
}

// ─── Mağaza kartı ───────────────────────────────────────────────────────────

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
  const [error, setError] = useState<string | null>(null);
  const isActive = store.status === "active";

  async function toggleStatus() {
    setBusy(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function removeStore() {
    if (!window.confirm(`"${store.name}" mağazasını silmek istediğine emin misin?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/etsy/stores/${store.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Silinemedi");
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silinemedi");
      setBusy(false);
    }
  }

  const icon = findCatalogCategory(store.category ?? "")?.icon ?? "🛍️";

  return (
    <div className="relative bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 flex flex-col gap-4 hover:border-[#8b5cf6]/30 transition-all duration-200">
      <button
        onClick={removeStore}
        disabled={busy}
        title="Mağazayı sil"
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#1e1e2e] hover:bg-red-500/20 flex items-center justify-center text-[#6b6b80] hover:text-red-400 transition-all disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Başlık */}
      <div className="flex items-start justify-between pr-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center text-lg">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{store.name}</div>
            <div className="text-xs text-[#6b6b80]">
              {store.category ?? "—"}
              {store.sub_category ? ` · ${store.sub_category}` : ""}
            </div>
          </div>
        </div>
        <Badge variant="muted">{store.currency}</Badge>
      </div>

      {/* Ürün sayısı */}
      <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3">
        <div className="text-xs text-[#6b6b80] uppercase tracking-wider mb-1">ÜRETİLEN ÜRÜN</div>
        <div className="text-2xl font-bold text-white">{productCount}</div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Alt aksiyon */}
      <div className="flex items-center justify-between gap-3">
        <Badge variant={isActive ? "success" : "danger"}>
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
          {isActive ? "AKTİF" : "PASİF"}
        </Badge>
        <button
          onClick={toggleStatus}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#1e1e2e] text-[#a0a0b0] hover:text-white hover:border-[#8b5cf6] transition-all disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
          {isActive ? "Durdur" : "Başlat"}
        </button>
      </div>
    </div>
  );
}

// ─── Mağaza ekleme modali (listflow AddStoreModal, gerçek katalog + API) ────

function AddStoreModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [storeName, setStoreName] = useState("");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [currency, setCurrency] = useState<(typeof ETSY_CURRENCIES)[number]>("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subCategories = findCatalogCategory(category)?.subCategories ?? [];

  function handleClose() {
    setStoreName("");
    setCategory("");
    setSubCategory("");
    setCurrency("USD");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName.trim() || !category || !subCategory) {
      setError("Mağaza adı, kategori ve alt kategori zorunlu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/etsy/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: storeName.trim(), category, sub_category: subCategory, currency }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Mağaza eklenemedi");
      }
      handleClose();
      onSuccess();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Mağaza eklenemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Başlık */}
        <div className="flex flex-col items-center text-center gap-3 pb-4 border-b border-[#1e1e2e]">
          <div className="w-12 h-12 rounded-xl bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-[#8b5cf6]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Mağaza Kaydı</h2>
            <p className="text-xs text-[#6b6b80] mt-0.5">
              Kaydı tamamla, otomasyon ilk denetimde üretime başlasın.
            </p>
          </div>
        </div>

        <Input
          label="MAĞAZA ADI"
          type="text"
          placeholder="Örn: WoodDesignTR"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          required
        />

        <Select
          label="ANA KATEGORİ"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSubCategory("");
          }}
          required
        >
          <option value="">Kategori seçin...</option>
          {ETSY_CATALOG.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.name}
            </option>
          ))}
        </Select>

        {category && (
          <div className="flex flex-col gap-1.5">
            <Select
              label="ALT KATEGORİ (ÜRETİM HATTI)"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              required
            >
              <option value="">Alt kategori seçin...</option>
              {subCategories.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </Select>
            <p className="text-xs text-[#06b6d4] flex items-center gap-1">
              <Info className="w-3 h-3" />
              Otomasyon bu üretim hattı için görsel + başlık + açıklama üretir
            </p>
          </div>
        )}

        {/* Para birimi */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#a0a0b0] uppercase tracking-wider">
            MAĞAZA PARA BİRİMİ
          </label>
          <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
            {ETSY_CURRENCIES.map((c, i) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex-1 py-2.5 text-sm font-medium transition-all duration-150 ${
                  i > 0 ? "border-l border-[#1e1e2e]" : ""
                } ${
                  currency === c ? "bg-[#8b5cf6] text-white" : "bg-[#0a0a0f] text-[#6b6b80] hover:text-white"
                }`}
              >
                {c === "USD" ? "$ DOLAR" : "₺ TÜRK LİRASI"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="bg-[#8b5cf6]/5 border border-[#8b5cf6]/20 rounded-lg p-3 flex gap-2">
          <Info className="w-4 h-4 text-[#8b5cf6] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#a0a0b0] leading-relaxed">
            Mağaza eklenince otomasyon kaydı otomatik oluşturulur — motor ilk 30 saniyelik
            denetiminde mağazanı görüp üretime başlar.
          </p>
        </div>

        <div className="flex gap-3 pt-2 border-t border-[#1e1e2e]">
          <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
            VAZGEÇ
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={loading}>
            MAĞAZAYI EKLE
          </Button>
        </div>
      </form>
    </Modal>
  );
}
