import { runRadar, DEFAULT_RADAR_CONFIG } from "@/lib/amazon-radar";
import { SAMPLE_CANDIDATES } from "@/lib/amazon-radar-samples";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

export const dynamic = "force-dynamic";

export default function AdminAmazonPage() {
  const symbol = AMAZON_MARKETS.us.symbol;
  const results = runRadar(SAMPLE_CANDIDATES, { market: "us", ...DEFAULT_RADAR_CONFIG });
  const winners = results.filter((r) => r.verdict.pass);
  const rejected = results.filter((r) => !r.verdict.pass);

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1rem",
  };

  return (
    <div style={{ color: "#f0f6fc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>AmazonBot Radar</h1>
        <span style={{ fontSize: "0.75rem", color: "#d29922", border: "1px solid #d2992255", borderRadius: 999, padding: "4px 10px" }}>
          DEMO VERİ — kaynak (AliExpress API + Keepa) bağlanınca canlı
        </span>
      </div>

      {/* Özet */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        {[
          { label: "Taranan aday", value: results.length, color: "#10b981" },
          { label: "Kazanan", value: winners.length, color: "#16a34a" },
          { label: "Elenen", value: rejected.length, color: "#8b949e" },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <p style={{ fontSize: "0.72rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Kazananlar */}
      <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Kazananlar</h2>
      <div style={{ ...cardStyle, padding: 0, marginBottom: "1.25rem" }}>
        {winners.map((r, i) => (
          <div key={r.candidate.aliId} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderBottom: i < winners.length - 1 ? "1px solid #21262d" : undefined }}>
            <span style={{ fontSize: "0.85rem" }}>{r.candidate.title}</span>
            <span style={{ fontSize: "0.8rem", color: "#8b949e", whiteSpace: "nowrap" }}>
              <b style={{ color: "#10b981" }}>{r.verdict.score}/100</b>
              {r.verdict.pricing ? ` · ${symbol}${r.verdict.pricing.salePrice} · kâr ${symbol}${r.verdict.pricing.netProfit}` : ""}
            </span>
          </div>
        ))}
        {winners.length === 0 && <p style={{ padding: "12px 14px", color: "#8b949e", fontSize: "0.85rem" }}>Kazanan yok.</p>}
      </div>

      {/* Elenenler */}
      <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.75rem" }}>Elenenler</h2>
      <div style={{ ...cardStyle, padding: 0 }}>
        {rejected.map((r, i) => (
          <div key={r.candidate.aliId} style={{ padding: "10px 14px", borderBottom: i < rejected.length - 1 ? "1px solid #21262d" : undefined }}>
            <p style={{ fontSize: "0.85rem", margin: 0 }}>{r.candidate.title}</p>
            <p style={{ fontSize: "0.75rem", color: "#f85149", margin: "4px 0 0" }}>{r.verdict.reasons.join(" · ")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
