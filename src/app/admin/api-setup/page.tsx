// API Kurulum rehberi + canlı env durumu (admin). Sunucu bileşeni — env'i doğrudan okur.
// Değerler ASLA gösterilmez; sadece "dolu/eksik" durumu.

export const dynamic = "force-dynamic";

function isSet(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim().length > 0);
}

interface EnvVar { name: string; required: boolean; note?: string }
interface Integration {
  title: string;
  desc: string;
  steps: string[];
  vars: EnvVar[];
}

const INTEGRATIONS: Integration[] = [
  {
    title: "Amazon SP-API (listeleme + sipariş + kargo bildirimi)",
    desc: "AWS IAM / SigV4 GEREKMİYOR (2024'ten beri sadece LWA access token).",
    steps: [
      "Amazon hesabıyla Solution Provider Portal → geliştirici profili oluştur, kimlik doğrula.",
      "Onaylanınca 'Add new app client' → API Type: SP API.",
      "ROLLER (kritik): Product Listing + Inventory + Orders + 'Direct-to-Consumer Shipping (Restricted)' — sonuncusu sipariş PII'si ve kargo bildirimi için ŞART.",
      "LWA credentials → Client ID & Client Secret kopyala.",
      "App ID'yi kopyala; Redirect URI olarak /api/amazon/callback ekle.",
      "Kendi mağazan için 'Authorize app' (self-authorize) ya da kullanıcılar /amazon/stores → 'Mağaza bağla' ile OAuth yapar. Pazar otomatik tespit edilir.",
    ],
    vars: [
      { name: "AMAZON_LWA_CLIENT_ID", required: true },
      { name: "AMAZON_LWA_CLIENT_SECRET", required: true },
      { name: "AMAZON_SPAPI_APP_ID", required: true, note: "Mağaza bağlama (consent) için" },
      { name: "AMAZON_SPAPI_REDIRECT_URI", required: true, note: ".../api/amazon/callback" },
    ],
  },
  {
    title: "AliExpress Open Platform (Dropshipper API)",
    desc: "Ürün/stok çekme, sipariş verme, takip no. İmza: HMAC-SHA256 (kodda hazır).",
    steps: [
      "openservice.aliexpress.com → geliştirici ol.",
      "Uygulama oluştur → App Key + App Secret al.",
      "'Dropshipping API' iznine başvur (onay 2-5 gün).",
      "OAuth (authorization code) ile access_token + refresh_token al.",
      "Anahtarları .env'e gir; sistem imzalamayı (sha256) otomatik yapar.",
    ],
    vars: [
      { name: "ALIEXPRESS_APP_KEY", required: true },
      { name: "ALIEXPRESS_APP_SECRET", required: true },
      { name: "ALIEXPRESS_ACCESS_TOKEN", required: true },
      { name: "ALIEXPRESS_REFRESH_TOKEN", required: false, note: "Token yenileme için" },
      { name: "ALIEXPRESS_SHIP_TO", required: false, note: "Varsayılan US" },
    ],
  },
  {
    title: "Takip kodu çevirme (17track veya AfterShip)",
    desc: "AliExpress (Cainiao) numarasını Amazon'da geçerli son-mil numaraya çevirir (VTR koruması).",
    steps: [
      "17track.net (ya da aftership.com) → API anahtarı al.",
      "Birini .env'e gir; ikisinden biri yeterli.",
    ],
    vars: [
      { name: "SEVENTEENTRACK_API_KEY", required: false, note: "17track" },
      { name: "AFTERSHIP_API_KEY", required: false, note: "AfterShip (alternatif)" },
    ],
  },
  {
    title: "Keepa (Amazon talep/BSR — radar)",
    desc: "Radarın canlı BSR/satış tahmini verisi.",
    steps: ["keepa.com → API aboneliği → anahtar."],
    vars: [{ name: "KEEPA_API_KEY", required: false }],
  },
  {
    title: "eBay Sell API",
    desc: "eBayBot için mağaza bağlama + listeleme.",
    steps: ["developer.ebay.com → uygulama → Client ID/Secret + Redirect URI (RuName)."],
    vars: [
      { name: "EBAY_CLIENT_ID", required: true },
      { name: "EBAY_CLIENT_SECRET", required: true },
      { name: "EBAY_REDIRECT_URI", required: true },
    ],
  },
];

export default function ApiSetupPage() {
  return (
    <div style={{ color: "#f0f6fc", maxWidth: 880 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0 0 0.25rem" }}>API Kurulumu</h1>
      <p style={{ color: "#8b949e", fontSize: "0.85rem", margin: "0 0 1.5rem" }}>
        Her entegrasyonun adımları + .env durumu. Yeşil = dolu, kırmızı = eksik. Değerler güvenlik için gösterilmez.
        Anahtarları VPS'te <code>/opt/ebay/.env</code> içine girip <code>docker compose up -d</code> ile uygula.
      </p>

      {INTEGRATIONS.map((it) => {
        const missing = it.vars.filter((v) => v.required && !isSet(v.name)).length;
        return (
          <div key={it.title} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid #30363d", borderRadius: 12, padding: "1.1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>{it.title}</h2>
              <span style={{ fontSize: "0.7rem", whiteSpace: "nowrap", padding: "3px 9px", borderRadius: 999,
                color: missing === 0 ? "#3fb950" : "#f85149",
                border: `1px solid ${missing === 0 ? "#3fb95055" : "#f8514955"}` }}>
                {missing === 0 ? "HAZIR" : `${missing} eksik`}
              </span>
            </div>
            <p style={{ color: "#8b949e", fontSize: "0.78rem", margin: "0 0 0.75rem" }}>{it.desc}</p>

            <ol style={{ margin: "0 0 0.9rem", paddingLeft: "1.1rem", color: "#c9d1d9", fontSize: "0.82rem", lineHeight: 1.6 }}>
              {it.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>

            <div style={{ display: "grid", gap: 6 }}>
              {it.vars.map((v) => {
                const set = isSet(v.name);
                return (
                  <div key={v.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: set ? "#3fb950" : (v.required ? "#f85149" : "#8b949e") }} />
                    <code style={{ color: set ? "#3fb950" : "#f0f6fc" }}>{v.name}</code>
                    {!v.required && <span style={{ color: "#8b949e", fontSize: "0.7rem" }}>(opsiyonel)</span>}
                    {v.note && <span style={{ color: "#6e7681", fontSize: "0.72rem" }}>— {v.note}</span>}
                    <span style={{ marginLeft: "auto", color: set ? "#3fb950" : "#6e7681", fontSize: "0.72rem" }}>
                      {set ? "dolu ✓" : "boş"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
