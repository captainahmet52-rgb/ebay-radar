"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Robot,
  Power,
  Clock,
  Funnel,
  CloudUpload,
  ListCheck,
  CashCoin,
  Percent,
  Tag,
  GraphUpArrow,
  LightningFill,
  PlayFill,
  Save,
  CheckCircle,
  XCircle,
  Hourglass,
  Inbox,
} from "./icons";

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface Settings {
  autoUploadEnabled:     boolean;
  uploadSchedule:        string;
  uploadScheduleHour:    number;
  uploadDailyLimit:      number;
  uploadMinProfit:       number;
  uploadMinMarginPct:    number;
  uploadMinAmazonPrice:  number;
  uploadMaxAmazonPrice:  number;
  uploadPrimeOnly:       boolean;
  uploadSoldWithinDays:  number | null;
  uploadSourceMarket:    string;
  uploadEbaySite:        string;
  uploadProfitMarginPct: number;
  uploadQuantity:        number;
  uploadAutoPublish:     boolean;
}

interface UploadLog {
  id:               string;
  status:           string;
  productsUploaded: number;
  productsSkipped:  number;
  productsChecked:  number;
  errorMessage:     string | null;
  ranAt:            string;
}

const DEFAULT_SETTINGS: Settings = {
  autoUploadEnabled:     false,
  uploadSchedule:        "daily",
  uploadScheduleHour:    9,
  uploadDailyLimit:      10,
  uploadMinProfit:       2,
  uploadMinMarginPct:    10,
  uploadMinAmazonPrice:  0,
  uploadMaxAmazonPrice:  150,
  uploadPrimeOnly:       false,
  uploadSoldWithinDays:  7,
  uploadSourceMarket:    "US",
  uploadEbaySite:        "EBAY_US",
  uploadProfitMarginPct: 30,
  uploadQuantity:        1,
  uploadAutoPublish:     true,
};

// ─── Stil sabitleri ───────────────────────────────────────────────────────────

const C = {
  bg:      "#0d1117",
  card:    "#161b22",
  border:  "#30363d",
  text:    "#f0f6fc",
  muted:   "#8b949e",
  accent:  "#00ffcc",
  accent2: "#58a6ff",
  success: "#3ddc84",
  warning: "#f0a500",
  danger:  "#ff6b6b",
};

const inputStyle: React.CSSProperties = {
  background: C.bg,
  color: C.text,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: "0.85rem",
  width: "100%",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  padding: "1rem",
  marginBottom: "0.75rem",
};

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <h6 style={{ color: C.text, fontWeight: 700, marginBottom: "0.75rem", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: C.accent }}>{icon}</span>
      {text}
    </h6>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: "0.75rem", color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: 4 }}>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: 4 }}>{children}</div>;
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

export default function AutoUploadPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "danger" } | null>(null);

  const showToast = (msg: string, type: "success" | "danger") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/auto-upload/settings");
    if (res.ok) {
      const data = await res.json();
      setSettings((prev) => ({ ...prev, ...data }));
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/auto-upload/history");
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
      setLogTotal(data.total ?? 0);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, [loadSettings, loadHistory]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/auto-upload/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (res.ok) showToast("Ayarlar kaydedildi ✓", "success");
      else showToast(data.error ?? "Bir hata oluştu", "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (!confirm("Şimdi çalıştırılsın mı?")) return;
    setRunning(true);
    try {
      const res = await fetch("/api/auto-upload/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message ?? "Başlatıldı", "success");
        setTimeout(loadHistory, 1500);
      } else {
        showToast(data.error ?? "Hata", "danger");
      }
    } finally {
      setRunning(false);
    }
  };

  const hourlySchedules = ["every_2h", "every_4h", "every_6h", "every_12h", "manual"];
  const showHourPicker = !hourlySchedules.includes(settings.uploadSchedule);

  return (
    <div style={{ color: C.text, minHeight: "100vh" }}>
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h4 style={{ fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: C.accent }}><Robot /></span>
          Otomatik Yükleme
        </h4>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              background: "transparent",
              border: `1px solid ${C.success}`,
              color: C.success,
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: running ? 0.6 : 1,
            }}
          >
            <PlayFill /> {running ? "Çalışıyor..." : "Şimdi Çalıştır"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: C.accent2,
              border: "none",
              color: "#000",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save /> {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* İki kolon layout */}
      <div style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gap: "1.5rem" }}>

        {/* ── SOL PANEL ── */}
        <div>

          {/* Toggle */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6 }}>
                  <Power /> Otomatik Yükleme
                </div>
                <div style={{ fontSize: "0.82rem", color: C.muted, marginTop: 2 }}>
                  Aktif olduğunda zamanlanmış yükleme çalışır
                </div>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: 52, height: 26, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={settings.autoUploadEnabled}
                  onChange={(e) => set("autoUploadEnabled", e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  onClick={() => set("autoUploadEnabled", !settings.autoUploadEnabled)}
                  style={{
                    position: "absolute", cursor: "pointer", inset: 0, borderRadius: 26,
                    background: settings.autoUploadEnabled ? C.accent : C.border,
                    transition: "0.3s",
                  }}
                >
                  <span style={{
                    position: "absolute", height: 20, width: 20, left: settings.autoUploadEnabled ? 28 : 3, bottom: 3,
                    borderRadius: "50%", background: settings.autoUploadEnabled ? "#000" : C.muted,
                    transition: "0.3s",
                  }} />
                </span>
              </label>
            </div>
          </div>

          {/* Zamanlama */}
          <div style={cardStyle}>
            <SectionTitle icon={<Clock />} text="Zamanlama" />
            <div style={{ display: "grid", gridTemplateColumns: showHourPicker ? "2fr 1fr" : "1fr", gap: 8, marginBottom: 8 }}>
              <div>
                <FieldLabel>Sıklık</FieldLabel>
                <select
                  style={selectStyle}
                  value={settings.uploadSchedule}
                  onChange={(e) => set("uploadSchedule", e.target.value)}
                >
                  <option value="every_2h">Her 2 Saatte Bir</option>
                  <option value="every_4h">Her 4 Saatte Bir</option>
                  <option value="every_6h">Her 6 Saatte Bir</option>
                  <option value="every_12h">Her 12 Saatte Bir</option>
                  <option value="daily">Her Gün</option>
                  <option value="weekly">Haftada Bir</option>
                  <option value="manual">Sadece Manuel</option>
                </select>
              </div>
              {showHourPicker && (
                <div>
                  <FieldLabel>Saat</FieldLabel>
                  <select
                    style={selectStyle}
                    value={settings.uploadScheduleHour}
                    onChange={(e) => set("uploadScheduleHour", parseInt(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <FieldLabel>Günlük Limit (ürün)</FieldLabel>
              <input
                type="number"
                style={inputStyle}
                value={settings.uploadDailyLimit}
                min={1} max={500}
                onChange={(e) => set("uploadDailyLimit", parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Ürün Kriterleri */}
          <div style={cardStyle}>
            <SectionTitle icon={<Funnel />} text="Ürün Kriterleri" />

            {/* Min Kâr */}
            <div style={{ marginBottom: 12 }}>
              <FieldLabel><CashCoin /> En Az Kâr <span style={{ color: C.accent }} title="Net kâr bu değerin üzerinde olmalı"> ⓘ</span></FieldLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <span style={{ background: C.bg, border: `1px solid ${C.border}`, borderRight: "none", borderRadius: "6px 0 0 6px", padding: "6px 10px", color: C.muted, fontSize: "0.85rem" }}>$</span>
                <input type="number" style={{ ...inputStyle, borderRadius: "0 6px 6px 0", flex: 1 }}
                  value={settings.uploadMinProfit} min={0} step={1}
                  onChange={(e) => set("uploadMinProfit", parseFloat(e.target.value) || 0)}
                />
              </div>
              <Hint>Önerilen: $2 — $5 arası</Hint>
            </div>

            {/* Min Kâr % */}
            <div style={{ marginBottom: 12 }}>
              <FieldLabel><Percent /> En Az Kâr Oranı <span style={{ color: C.accent }} title="Kâr / Amazon fiyatı × 100"> ⓘ</span></FieldLabel>
              <div style={{ display: "flex", alignItems: "center" }}>
                <input type="number" style={{ ...inputStyle, borderRadius: "6px 0 0 6px", flex: 1 }}
                  value={settings.uploadMinMarginPct} min={0} max={100} step={1}
                  onChange={(e) => set("uploadMinMarginPct", parseFloat(e.target.value) || 0)}
                />
                <span style={{ background: C.bg, border: `1px solid ${C.border}`, borderLeft: "none", borderRadius: "0 6px 6px 0", padding: "6px 10px", color: C.muted, fontSize: "0.85rem" }}>%</span>
              </div>
              <Hint>Önerilen: %10 — %20 arası</Hint>
            </div>

            {/* Fiyat Aralığı */}
            <div style={{ marginBottom: 12 }}>
              <FieldLabel><Tag /> Amazon Fiyat Aralığı <span style={{ color: C.accent }} title="Amazon fiyat aralığı"> ⓘ</span></FieldLabel>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ display: "flex", flex: 1 }}>
                  <span style={{ background: C.bg, border: `1px solid ${C.border}`, borderRight: "none", borderRadius: "6px 0 0 6px", padding: "6px 8px", color: C.muted, fontSize: "0.8rem", whiteSpace: "nowrap" }}>Min $</span>
                  <input type="number" style={{ ...inputStyle, borderRadius: "0 6px 6px 0", flex: 1 }}
                    value={settings.uploadMinAmazonPrice} min={0} step={1}
                    onChange={(e) => set("uploadMinAmazonPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <span style={{ color: C.muted }}>—</span>
                <div style={{ display: "flex", flex: 1 }}>
                  <span style={{ background: C.bg, border: `1px solid ${C.border}`, borderRight: "none", borderRadius: "6px 0 0 6px", padding: "6px 8px", color: C.muted, fontSize: "0.8rem", whiteSpace: "nowrap" }}>Maks $</span>
                  <input type="number" style={{ ...inputStyle, borderRadius: "0 6px 6px 0", flex: 1 }}
                    value={settings.uploadMaxAmazonPrice} min={0} step={1}
                    onChange={(e) => set("uploadMaxAmazonPrice", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <Hint>Önerilen: $5 — $150 arası</Hint>
            </div>

            {/* Satış Aktivitesi */}
            <div style={{ marginBottom: 12 }}>
              <FieldLabel><GraphUpArrow /> Satış Aktivitesi <span style={{ color: C.accent }} title="eBay'de en son ne zaman satıldığı"> ⓘ</span></FieldLabel>
              <select style={selectStyle}
                value={settings.uploadSoldWithinDays ?? ""}
                onChange={(e) => set("uploadSoldWithinDays", e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Filtre yok (tüm ürünler)</option>
                <option value="1">Son 1 günde satılmış 🔥</option>
                <option value="3">Son 3 günde satılmış</option>
                <option value="7">Son 7 günde satılmış</option>
                <option value="30">Son 30 günde satılmış</option>
              </select>
              <Hint>Önerilen: Son 7 günde satılmış</Hint>
            </div>

            {/* Pazar Yeri */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div>
                <FieldLabel>Amazon Pazarı</FieldLabel>
                <select style={selectStyle} value={settings.uploadSourceMarket}
                  onChange={(e) => set("uploadSourceMarket", e.target.value)}>
                  <option value="US">🇺🇸 Amazon US</option>
                  <option value="UK">🇬🇧 Amazon UK</option>
                </select>
              </div>
              <div>
                <FieldLabel>eBay Pazarı</FieldLabel>
                <select style={selectStyle} value={settings.uploadEbaySite}
                  onChange={(e) => set("uploadEbaySite", e.target.value)}>
                  <option value="EBAY_US">🇺🇸 eBay US</option>
                  <option value="EBAY_GB">🇬🇧 eBay UK</option>
                  <option value="EBAY_DE">🇩🇪 eBay Almanya</option>
                  <option value="EBAY_AU">🇦🇺 eBay Avustralya</option>
                </select>
              </div>
            </div>

            {/* Prime */}
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.2)" }}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={settings.uploadPrimeOnly}
                  onChange={(e) => set("uploadPrimeOnly", e.target.checked)}
                  style={{ marginTop: 2, accentColor: C.warning, width: 16, height: 16 }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: C.text, fontSize: "0.88rem" }}>
                    <LightningFill style={{ color: "orange" }} /> Sadece Prime Ürünler
                  </div>
                  <div style={{ fontSize: "0.78rem", color: C.muted, marginTop: 4 }}>
                    Hızlı kargo avantajı için Amazon Prime ürünlerini tercih et
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Yükleme Ayarları */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <SectionTitle icon={<CloudUpload />} text="Yükleme Ayarları" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div>
                <FieldLabel>Kâr Marjı (%)</FieldLabel>
                <input type="number" style={inputStyle}
                  value={settings.uploadProfitMarginPct} min={0} max={100} step={1}
                  onChange={(e) => set("uploadProfitMarginPct", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <FieldLabel>Stok Adedi</FieldLabel>
                <input type="number" style={inputStyle}
                  value={settings.uploadQuantity} min={1}
                  onChange={(e) => set("uploadQuantity", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.85rem", color: C.text }}>
              <input type="checkbox" checked={settings.uploadAutoPublish}
                onChange={(e) => set("uploadAutoPublish", e.target.checked)}
                style={{ accentColor: C.accent, width: 16, height: 16 }}
              />
              Otomatik eBay&apos;e yayınla (kapalıysa taslak)
            </label>
          </div>
        </div>

        {/* ── SAĞ PANEL — Yükleme Geçmişi ── */}
        <div>
          <div style={{ ...cardStyle, marginBottom: 0, minHeight: 400 }}>
            <SectionTitle
              icon={<ListCheck />}
              text={`Yükleme Geçmişi`}
            />
            {/* Badge */}
            <span style={{ display: "inline-block", background: C.border, color: C.muted, borderRadius: 20, padding: "1px 10px", fontSize: "0.75rem", fontWeight: 600, marginBottom: "1rem" }}>
              {logTotal}
            </span>

            {logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2.5rem 0", color: C.muted }}>
                <Inbox style={{ fontSize: "2rem", display: "block", margin: "0 auto 8px" }} />
                <div>Henüz yükleme yapılmamış</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ color: C.muted, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>Tarih</th>
                      <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>Durum</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>İncelenen</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>Yüklenen</th>
                      <th style={{ textAlign: "center", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>Atlanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                        <td style={{ padding: "10px 10px", color: C.muted, whiteSpace: "nowrap" }}>
                          {new Date(log.ranAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "10px 10px" }}>
                          <StatusBadge status={log.status} />
                        </td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: C.text }}>{log.productsChecked}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: C.success, fontWeight: 600 }}>{log.productsUploaded}</td>
                        <td style={{ padding: "10px 10px", textAlign: "center", color: C.muted }}>{log.productsSkipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 9999,
          padding: "0.75rem 1.25rem", borderRadius: 8,
          background: toast.type === "success" ? "#10b981" : "#ef4444",
          color: "#fff", fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,.3)",
          fontSize: "0.9rem",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
    success: { bg: "rgba(61,220,132,0.15)", color: "#3ddc84", label: "Başarılı",  icon: <CheckCircle /> },
    partial: { bg: "rgba(240,165,0,0.15)",  color: "#f0a500", label: "Kısmi",     icon: <Hourglass /> },
    failed:  { bg: "rgba(255,107,107,0.15)", color: "#ff6b6b", label: "Hata",     icon: <XCircle /> },
  };
  const s = map[status] ?? map.partial;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, background: s.bg, color: s.color, fontSize: "0.75rem", fontWeight: 600 }}>
      {s.icon} {s.label}
    </span>
  );
}
