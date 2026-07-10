import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Etsy admin paneli — iskele.
 * Etsy tarafı ayrı bir sistemde (EtsyFlow / Supabase) çalışır, ana veritabanında
 * değildir. Bu yüzden burada eBay/Amazon gibi doğrudan istatistik yoktur; EtsyFlow
 * yönetim köprüsü kurulunca (sipariş havuzu, mağaza sağlığı vb.) bu sayfa dolar.
 */
export default function AdminEtsyPage() {
  return (
    <div style={{ color: "#f0f6fc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Etsy Admin</h1>
      </div>

      <div
        style={{
          background: "rgba(236,72,153,0.06)",
          border: "1px solid rgba(236,72,153,0.25)",
          borderRadius: 12,
          padding: "1.5rem",
          maxWidth: 640,
        }}
      >
        <p style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: 8, color: "#ec4899" }}>
          Etsy ayrı bir sistemde çalışıyor (EtsyFlow)
        </p>
        <p style={{ fontSize: "0.85rem", color: "#8b949e", lineHeight: 1.6, marginBottom: "1rem" }}>
          Etsy mağaza, ürün ve sipariş verileri EtsyFlow (Supabase) tarafında tutulur; ana veritabanında
          olmadığı için eBay/Amazon gibi doğrudan istatistik burada gösterilemiyor. Etsy yönetim köprüsü
          (admin sipariş havuzu, mağaza sağlığı) kurulunca bu panel dolacak.
        </p>
        <Link
          href="/etsy"
          style={{
            display: "inline-block",
            padding: "0.5rem 1rem",
            borderRadius: 8,
            background: "rgba(236,72,153,0.15)",
            border: "1px solid rgba(236,72,153,0.35)",
            color: "#ec4899",
            fontSize: "0.85rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Etsy müşteri paneline git →
        </Link>
      </div>
    </div>
  );
}
