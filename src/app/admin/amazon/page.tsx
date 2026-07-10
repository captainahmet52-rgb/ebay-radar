"use client";

import { useEffect, useState } from "react";

interface DepotProduct {
  id: string; aliId: string; title: string | null; category: string | null; brand: string | null;
  radarScore: number | null; aliCostUsd: number; aliOrders: number; aliRating: number;
  amazonBsr: number | null; aliStockStatus: string; status: string;
}
interface Stats {
  depotTotal: number; depotActive: number; depotPaused: number;
  accounts: number; listings: number; orders: number; riskOrders: number;
}
interface UploadedListing {
  id: string; market: string; salePrice: number | null; currentQty: number;
  status: string; publishStage: string | null;
  product: { title: string | null; aliId: string };
  user: { email: string };
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1rem",
};

export default function AdminAmazonPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [products, setProducts] = useState<DepotProduct[]>([]);
  const [uploaded, setUploaded] = useState<UploadedListing[]>([]);
  const [tab, setTab] = useState<"depot" | "uploaded">("depot");
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/amazon/radar");
    if (r.ok) { const d = await r.json(); setStats(d.stats); setProducts(d.products); setUploaded(d.uploaded ?? []); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function clearDepot() {
    if (!confirm("Depodaki tüm ürünler silinecek (test/örnek verisi). Emin misin?")) return;
    setClearing(true); setMsg(null);
    const r = await fetch("/api/admin/amazon/radar", { method: "DELETE" });
    const j = await r.json();
    setMsg(r.ok ? `${j.deleted} ürün silindi.` : (j.error ?? "Hata"));
    setClearing(false);
    void load();
  }

  const STAT_CARDS: Array<{ label: string; value: number; color: string }> = stats ? [
    { label: "Depo aktif", value: stats.depotActive, color: "#10b981" },
    { label: "Depo duraklatılmış", value: stats.depotPaused, color: "#d29922" },
    { label: "Depo toplam", value: stats.depotTotal, color: "#8b949e" },
    { label: "Bağlı hesap", value: stats.accounts, color: "#58a6ff" },
    { label: "Listeleme", value: stats.listings, color: "#10b981" },
    { label: "Sipariş", value: stats.orders, color: "#58a6ff" },
    { label: "Riskli sipariş", value: stats.riskOrders, color: "#f85149" },
  ] : [];

  return (
    <div style={{ color: "#f0f6fc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>AmazonBot Yönetimi</h1>
        <button
          onClick={clearDepot}
          disabled={clearing || products.length === 0}
          style={{ background: "transparent", color: "#f85149", fontWeight: 600, fontSize: "0.82rem", border: "1px solid #f8514955", borderRadius: 8, padding: "8px 16px", cursor: products.length === 0 ? "not-allowed" : "pointer", opacity: clearing || products.length === 0 ? 0.5 : 1 }}
        >
          {clearing ? "Siliniyor..." : "Depoyu Temizle"}
        </button>
      </div>
      {msg && <p style={{ color: "#8b949e", fontSize: "0.85rem", marginBottom: "1rem" }}>{msg}</p>}

      {/* İstatistik */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {STAT_CARDS.map((s) => (
          <div key={s.label} style={card}>
            <p style={{ fontSize: "0.7rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sekmeler */}
      <div style={{ display: "flex", gap: 8, marginBottom: "0.9rem" }}>
        {([["depot", `Depo (${products.length})`], ["uploaded", `Yüklenen ürünler (${uploaded.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ fontSize: "0.8rem", fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              background: tab === k ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${tab === k ? "#10b98155" : "#30363d"}`,
              color: tab === k ? "#10b981" : "#8b949e" }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#8b949e" }}>Yükleniyor...</p>
      ) : tab === "depot" ? (
        /* Radarın depoya yazdığı ürünler */
        products.length === 0 ? (
          <div style={{ ...card, color: "#8b949e", fontSize: "0.85rem" }}>
            Depo boş. Radar (Radar projesinde) çalışınca kazanan ürünleri buraya otomatik gönderir.
          </div>
        ) : (
          <div style={{ ...card, padding: 0 }}>
            {products.map((p, i) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: i < products.length - 1 ? "1px solid #21262d" : undefined }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>{p.title ?? p.aliId}</p>
                  <p style={{ fontSize: "0.72rem", color: "#8b949e", margin: "3px 0 0" }}>
                    ${p.aliCostUsd.toFixed(2)} · {p.category ?? "-"} · {p.aliOrders} sipariş · ⭐{p.aliRating}
                    {p.amazonBsr ? ` · BSR ${p.amazonBsr}` : ""} · stok {p.aliStockStatus}
                  </p>
                </div>
                <span style={{ fontSize: "0.8rem", color: p.status === "active" ? "#10b981" : "#d29922", whiteSpace: "nowrap" }}>
                  <b>{p.radarScore ?? 0}/100</b> · {p.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Depodan yüklenen ürünler (tüm kullanıcılar) */
        uploaded.length === 0 ? (
          <div style={{ ...card, color: "#8b949e", fontSize: "0.85rem" }}>
            Henüz depodan yüklenen ürün yok. Müşteriler oto-yüklemeyi açınca burada görünür.
          </div>
        ) : (
          <div style={{ ...card, padding: 0 }}>
            {uploaded.map((l, i) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: i < uploaded.length - 1 ? "1px solid #21262d" : undefined }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>{l.product.title ?? l.product.aliId}</p>
                  <p style={{ fontSize: "0.72rem", color: "#8b949e", margin: "3px 0 0" }}>
                    {l.market.toUpperCase()} · {l.user.email} · {l.currentQty} adet
                    {l.salePrice != null ? ` · ${l.salePrice.toFixed(2)}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: "0.8rem", color: l.status === "active" ? "#10b981" : "#d29922", whiteSpace: "nowrap" }}>
                  {l.publishStage ?? l.status}
                </span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
