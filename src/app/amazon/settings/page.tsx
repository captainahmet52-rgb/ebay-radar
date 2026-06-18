"use client";

import { useEffect, useState } from "react";
import { PageHeader, Card, InfoCard, AMZ_ACCENT } from "@/components/amazon/shared";
import { DEFAULT_RADAR_CONFIG } from "@/lib/amazon-radar";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

const MARKETS = Object.values(AMAZON_MARKETS);

interface AmazonSettings {
  amazonAutoUploadEnabled: boolean;
  amazonUploadDailyLimit: number;
  amazonUploadMinCostUsd: number;
  amazonUploadMaxCostUsd: number;
  amazonUploadQuantity: number;
  amazonUploadAutoPublish: boolean;
  amazonMarginUsPct: number | null;
  amazonMarginUkPct: number | null;
  amazonMarginAePct: number | null;
  amazonMarginSaPct: number | null;
}

const MARGIN_FIELD: Record<string, keyof AmazonSettings> = {
  us: "amazonMarginUsPct", uk: "amazonMarginUkPct", ae: "amazonMarginAePct", sa: "amazonMarginSaPct",
};

const RADAR_ROWS: Array<{ label: string; value: string }> = [
  { label: "Asgari kabul marjı", value: `%${DEFAULT_RADAR_CONFIG.minMarginPct}` },
  { label: "Maks. BSR (talep eşiği)", value: DEFAULT_RADAR_CONFIG.maxBsr.toLocaleString("tr-TR") },
  { label: "Aylık min. satış", value: String(DEFAULT_RADAR_CONFIG.minSalesEst) },
  { label: "Maks. satıcı (rekabet)", value: String(DEFAULT_RADAR_CONFIG.maxSellers) },
  { label: "AliExpress min. sipariş", value: String(DEFAULT_RADAR_CONFIG.minAliOrders) },
  { label: "AliExpress min. puan", value: String(DEFAULT_RADAR_CONFIG.minAliRating) },
];

const inputCls =
  "w-28 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50";

export default function AmazonSettingsPage() {
  const [s, setS] = useState<AmazonSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/amazon/settings")
      .then((r) => r.json())
      .then((d) => setS(d))
      .catch(() => setMsg("Ayarlar yüklenemedi"));
  }, []);

  function set<K extends keyof AmazonSettings>(k: K, v: AmazonSettings[K]) {
    setS((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/amazon/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Kaydedilemedi");
      setMsg("Kaydedildi ✓");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Pazar başına kâr marjı, yükleme kuralları ve radar eşikleri." />
      <div className="space-y-6 max-w-3xl">
        {/* Pazar başına marj (düzenlenebilir) */}
        <div>
          <h2 className="text-lg font-bold mb-1">Pazar başına kâr marjı</h2>
          <p className="text-sm text-slate-400 mb-3">
            Boş bırakırsan pazarın varsayılanı kullanılır. Her pazarın KDV/gümrüğü farklı —
            fiyat bu marja göre KDV ve gümrük dahil otomatik hesaplanır.
          </p>
          <Card pad="p-0">
            <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 border-b border-white/5">
              <span className="col-span-2">Pazar</span>
              <span className="text-right">Senin marjın %</span>
              <span className="text-right">KDV</span>
              <span className="text-right">Gümrük</span>
            </div>
            {MARKETS.map((m) => {
              const field = MARGIN_FIELD[m.key];
              const val = s ? (s[field] as number | null) : null;
              return (
                <div key={m.key} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-white/5 last:border-0 items-center">
                  <span className="col-span-2 text-sm">{m.name}</span>
                  <span className="text-right">
                    <input
                      type="number"
                      className={inputCls}
                      disabled={!s}
                      placeholder={`${Math.round(m.defaultMargin * 100)} (vars.)`}
                      value={val ?? ""}
                      onChange={(e) =>
                        set(field, (e.target.value === "" ? null : Number(e.target.value)) as never)
                      }
                    />
                  </span>
                  <span className="text-right text-sm text-slate-400">%{Math.round(m.vatRate * 100)}</span>
                  <span className="text-right text-sm text-slate-400">%{Math.round(m.customsDutyRate * 100)}</span>
                </div>
              );
            })}
          </Card>
        </div>

        {/* Yükleme kuralları */}
        <div>
          <h2 className="text-lg font-bold mb-3">Yükleme kuralları</h2>
          <Card pad="p-0">
            <Row label="Otomatik yükleme açık">
              <Toggle on={!!s?.amazonAutoUploadEnabled} disabled={!s} onChange={(v) => set("amazonAutoUploadEnabled", v)} />
            </Row>
            <Row label="Günlük yükleme limiti">
              <input type="number" className={inputCls} disabled={!s} value={s?.amazonUploadDailyLimit ?? ""} onChange={(e) => set("amazonUploadDailyLimit", Number(e.target.value))} />
            </Row>
            <Row label="AliExpress min. maliyet ($)">
              <input type="number" className={inputCls} disabled={!s} value={s?.amazonUploadMinCostUsd ?? ""} onChange={(e) => set("amazonUploadMinCostUsd", Number(e.target.value))} />
            </Row>
            <Row label="AliExpress maks. maliyet ($)">
              <input type="number" className={inputCls} disabled={!s} value={s?.amazonUploadMaxCostUsd ?? ""} onChange={(e) => set("amazonUploadMaxCostUsd", Number(e.target.value))} />
            </Row>
            <Row label="Liste adedi (qty)">
              <input type="number" className={inputCls} disabled={!s} value={s?.amazonUploadQuantity ?? ""} onChange={(e) => set("amazonUploadQuantity", Number(e.target.value))} />
            </Row>
            <Row label="Otomatik yayınla">
              <Toggle on={!!s?.amazonUploadAutoPublish} disabled={!s} onChange={(v) => set("amazonUploadAutoPublish", v)} />
            </Row>
          </Card>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={save}
              disabled={!s || saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: AMZ_ACCENT }}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            {msg && <span className="text-sm text-slate-400">{msg}</span>}
          </div>
        </div>

        {/* Radar eşikleri (salt-okunur) */}
        <div>
          <h2 className="text-lg font-bold mb-3">Radar eşikleri</h2>
          <Card pad="p-0">
            <div className="divide-y divide-white/5">
              {RADAR_ROWS.map((r) => (
                <div key={r.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-400">{r.label}</span>
                  <span className="text-sm font-semibold" style={{ color: AMZ_ACCENT }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <InfoCard
          title="Marka/yasak filtresi her zaman açık"
          text="Markalı ve yasaklı ürünler radar tarafından otomatik elenir; bu ayar kapatılamaz. SP-API bağlanınca yükleme öncesi getListingsRestrictions ile son bir kontrol daha yapılır."
        />
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? AMZ_ACCENT : "rgba(255,255,255,0.15)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
      />
    </button>
  );
}
