"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Star, UploadCloud } from "lucide-react";
import { PageHeader, InfoCard, SHOPIFY_ACCENT } from "@/components/shopify/shared";

interface DepotRow {
  id: string;
  title: string | null;
  imageUrl: string | null;
  category: string | null;
  aliCostUsd: number;
  aliOrders: number;
  aliRating: number;
  suggestedPrice: number;
  estimatedProfitUsd: number;
}

interface AccountOpt {
  id: string;
  shopDomain: string;
  accessState: string;
}

export default function ShopifyDepotPage() {
  const [products, setProducts] = useState<DepotRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [accounts, setAccounts] = useState<AccountOpt[]>([]);
  const [accountId, setAccountId] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(async (query: string) => {
    setProducts(null);
    const res = await fetch(`/api/shopify/depot?q=${encodeURIComponent(query)}`);
    if (!res.ok) { setProducts([]); return; }
    const j = await res.json();
    setProducts(j.products);
    setTotal(j.total);
  }, []);

  useEffect(() => {
    void load("");
    void (async () => {
      const res = await fetch("/api/shopify/accounts");
      if (!res.ok) return;
      const j = await res.json();
      const usable = (j.accounts as AccountOpt[]).filter((a) => a.accessState !== "frozen");
      setAccounts(usable);
      if (usable[0]) setAccountId(usable[0].id);
    })();
  }, [load]);

  async function upload(productId: string) {
    if (!accountId) {
      setMsg({ text: "Önce Mağazalar sayfasından bir mağaza bağla.", ok: false });
      return;
    }
    setUploading(productId);
    setMsg(null);
    try {
      const res = await fetch("/api/shopify/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, productId }),
      });
      const j = await res.json();
      setMsg(res.ok
        ? { text: `Yüklendi — tahmini kâr $${j.estimatedProfitUsd?.toFixed?.(2) ?? "?"} / satış`, ok: true }
        : { text: j.error ?? "Yükleme başarısız", ok: false });
    } catch {
      setMsg({ text: "Bağlantı hatası — tekrar dene", ok: false });
    } finally {
      setUploading(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Depo"
        subtitle={`Ortak ürün havuzu (${total.toLocaleString("tr-TR")} ürün) — seç, mağazana yükle; stok/fiyat takibi otomatik.`}
      />

      <div className="space-y-5">
        {/* Araç çubuğu: arama + hedef mağaza */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-white/5 border border-white/10 flex-1 min-w-56">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load(q)}
              placeholder="Ürün ara…"
              className="bg-transparent outline-none text-sm flex-1 text-white placeholder:text-slate-600"
            />
          </div>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm bg-white/5 border border-white/10 text-white"
          >
            {accounts.length === 0 && <option value="">Mağaza yok — önce bağla</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-slate-900">{a.shopDomain}</option>
            ))}
          </select>
        </div>

        {msg && (
          <p className="text-sm font-medium" style={{ color: msg.ok ? "#22c55e" : "#f87171" }}>{msg.text}</p>
        )}

        {products === null ? (
          <div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Depo yükleniyor...
          </div>
        ) : products.length === 0 ? (
          <InfoCard
            title="Depo şu an boş"
            text="Radar sistemi ürün buldukça depo dolar. Depoya ürün düştüğünde burada görünecek ve tek tıkla mağazana yükleyebileceksin."
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="rounded-2xl overflow-hidden flex flex-col"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="aspect-square bg-white/5 flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-slate-600 text-xs">Görsel yok</span>
                  )}
                </div>
                <div className="p-3.5 flex flex-col flex-1">
                  <p className="text-xs font-medium leading-snug line-clamp-2 flex-1">{p.title ?? "—"}</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <Star className="h-3 w-3 fill-current text-amber-400" /> {p.aliRating.toFixed(1)}
                    </span>
                    <span>· {p.aliOrders.toLocaleString("tr-TR")} satış</span>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <div className="leading-tight">
                      <p className="text-sm font-black">${p.suggestedPrice.toFixed(2)}</p>
                      <p className="text-[10px]" style={{ color: SHOPIFY_ACCENT }}>
                        +${p.estimatedProfitUsd.toFixed(2)} kâr
                      </p>
                    </div>
                    <button
                      onClick={() => upload(p.id)}
                      disabled={uploading === p.id}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-black rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                      style={{ background: SHOPIFY_ACCENT }}
                    >
                      {uploading === p.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <UploadCloud className="h-3.5 w-3.5" />}
                      Yükle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
