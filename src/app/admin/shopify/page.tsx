"use client";

// Admin — ShopifyBot yönetimi (admin/amazon sayfasıyla aynı görsel dil).
// Mağazalar sekmesi: kim bağladı, paket, durum, senkron sağlığı.
// Siparişler sekmesi: tüm sistemin siparişleri + kaynak (AliExpress) riski.

import { useEffect, useState } from "react";

interface AccountRow {
  id: string;
  shopDomain: string;
  isActive: boolean;
  plan: string;
  productLimit: number;
  trialEndsAt: string | null;
  paidUntil: string | null;
  lastOrdersSyncAt: string | null;
  uninstalledAt: string | null;
  createdAt: string;
  user: { email: string };
  _count: { listings: number; orders: number };
}

interface OrderRow {
  id: string;
  name: string;
  totalPrice: number;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  sourcingStatus: string;
  aliCostUsd: number | null;
  shopifyCreatedAt: string;
  shopifyAccount: { shopDomain: string };
  user: { email: string };
}

interface Stats {
  accountsTotal: number;
  accountsActive: number;
  accountsFrozen: number;
  accountsUninstalled: number;
  listingsTotal: number;
  listingsActive: number;
  ordersTotal: number;
  riskOrders: number;
}

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1rem",
};

const SHOPIFY_GREEN = "#96bf48";

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminShopifyPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [tab, setTab] = useState<"accounts" | "orders">("accounts");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/shopify");
      if (r.ok) {
        const d = await r.json();
        setStats(d.stats); setAccounts(d.accounts); setOrders(d.orders);
      }
      setLoading(false);
    })();
  }, []);

  const STAT_CARDS: Array<{ label: string; value: number; color: string }> = stats ? [
    { label: "Mağaza toplam", value: stats.accountsTotal, color: "#8b949e" },
    { label: "Mağaza aktif", value: stats.accountsActive, color: SHOPIFY_GREEN },
    { label: "Donduruldu", value: stats.accountsFrozen, color: "#d29922" },
    { label: "Kaldırıldı", value: stats.accountsUninstalled, color: "#f85149" },
    { label: "Listeleme", value: stats.listingsTotal, color: "#58a6ff" },
    { label: "Aktif listeleme", value: stats.listingsActive, color: SHOPIFY_GREEN },
    { label: "Sipariş", value: stats.ordersTotal, color: "#58a6ff" },
    { label: "Riskli sipariş", value: stats.riskOrders, color: "#f85149" },
  ] : [];

  return (
    <div style={{ color: "#f0f6fc" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 1.25rem" }}>ShopifyBot Yönetimi</h1>

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
        {([["accounts", `Mağazalar (${accounts.length})`], ["orders", `Siparişler (${orders.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ fontSize: "0.8rem", fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
              background: tab === k ? "rgba(150,191,72,0.15)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${tab === k ? `${SHOPIFY_GREEN}55` : "#30363d"}`,
              color: tab === k ? SHOPIFY_GREEN : "#8b949e" }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#8b949e" }}>Yükleniyor...</p>
      ) : tab === "accounts" ? (
        accounts.length === 0 ? (
          <div style={{ ...card, color: "#8b949e", fontSize: "0.85rem" }}>
            Henüz bağlı Shopify mağazası yok. Kullanıcılar mağazalarını bağlayınca burada görünür.
          </div>
        ) : (
          <div style={{ ...card, padding: 0 }}>
            {accounts.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: i < accounts.length - 1 ? "1px solid #21262d" : undefined }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>
                    {a.shopDomain}
                    <span style={{ color: "#8b949e", fontSize: "0.75rem" }}> · {a.user.email}</span>
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#8b949e", margin: "3px 0 0" }}>
                    {a.plan} · {a._count.listings}/{a.productLimit} ürün · {a._count.orders} sipariş
                    {" · sipariş senkronu: "}{fmtDate(a.lastOrdersSyncAt)}
                    {a.paidUntil ? ` · paket bitiş: ${fmtDate(a.paidUntil)}` : a.trialEndsAt ? ` · deneme bitiş: ${fmtDate(a.trialEndsAt)}` : ""}
                  </p>
                </div>
                <span style={{
                  fontSize: "0.78rem", whiteSpace: "nowrap", fontWeight: 600,
                  color: a.uninstalledAt ? "#f85149" : a.isActive ? SHOPIFY_GREEN : "#d29922",
                }}>
                  {a.uninstalledAt ? "kaldırıldı" : a.isActive ? "aktif" : "donduruldu"}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        orders.length === 0 ? (
          <div style={{ ...card, color: "#8b949e", fontSize: "0.85rem" }}>
            Henüz sipariş yok. Mağazalara sipariş düştükçe (30 dk senkron) burada görünür.
          </div>
        ) : (
          <div style={{ ...card, padding: 0 }}>
            {orders.map((o, i) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: i < orders.length - 1 ? "1px solid #21262d" : undefined }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "0.85rem", margin: 0 }}>
                    {o.name}
                    <span style={{ color: "#8b949e", fontSize: "0.75rem" }}> · {o.shopifyAccount.shopDomain} · {o.user.email}</span>
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#8b949e", margin: "3px 0 0" }}>
                    {fmtDate(o.shopifyCreatedAt)} · {o.financialStatus ?? "-"} / {o.fulfillmentStatus ?? "-"}
                    {o.aliCostUsd != null ? ` · kaynak ~$${o.aliCostUsd.toFixed(2)}` : ""}
                  </p>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>
                    {o.totalPrice.toFixed(2)} {o.currency}
                  </p>
                  <p style={{
                    fontSize: "0.72rem", margin: "2px 0 0", fontWeight: 600,
                    color: o.sourcingStatus === "ok" ? SHOPIFY_GREEN : o.sourcingStatus === "ali_stock_risk" ? "#f85149" : "#8b949e",
                  }}>
                    {o.sourcingStatus === "ok" ? "kaynak hazır" : o.sourcingStatus === "ali_stock_risk" ? "stok riski" : "sistem dışı"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
