import { ImageResponse } from "next/og";

export const alt = "Lean Automation — Amazon, eBay ve Etsy Pazar Yeri Otomasyonu";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(ellipse at top right, #2e1065 0%, #0a0a12 45%, #050508 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo satırı */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 32 32" fill="none">
              <circle cx="11" cy="21" r="2.6" fill="#ffffff" />
              <path d="M11 15 A6 6 0 0 1 17 21" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M11 10 A11 11 0 0 1 22 21" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity={0.65} />
              <path d="M11 5 A16 16 0 0 1 27 21" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" opacity={0.4} />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 34, fontWeight: 900, letterSpacing: 6 }}>LEAN</span>
            <span style={{ fontSize: 22, color: "#9ca3af", letterSpacing: 6 }}>AUTOMATION</span>
          </div>
        </div>

        {/* Başlık */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 920 }}>
          <span style={{ fontSize: 66, fontWeight: 900, lineHeight: 1.1 }}>
            Pazar Yeri İşinizi
          </span>
          <span
            style={{
              fontSize: 66,
              fontWeight: 900,
              lineHeight: 1.1,
              color: "#c084fc",
            }}
          >
            AI ile Ölçeklendirin
          </span>
        </div>

        {/* Pazar yerleri */}
        <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
          {[
            { t: "Amazon", c: "#f59e0b" },
            { t: "eBay", c: "#3b82f6" },
            { t: "Etsy", c: "#f97316" },
          ].map((m) => (
            <div
              key={m.t}
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                color: m.c,
                border: `2px solid ${m.c}`,
                borderRadius: 14,
                padding: "10px 26px",
              }}
            >
              {m.t}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
