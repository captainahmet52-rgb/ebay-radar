"use client";

import { useEffect, useState } from "react";
import {
  Power, Clock, Filter, UploadCloud, ListChecks, DollarSign,
  Tag, PlayCircle, Save, CheckCircle2, XCircle, Timer, Loader2,
} from "lucide-react";
import { PageHeader, Card, Empty, InfoCard, AMZ_ACCENT } from "@/components/amazon/shared";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

const MARKETS = Object.values(AMAZON_MARKETS);

interface AmazonSettings {
  amazonAutoUploadEnabled: boolean;
  amazonUploadSchedule: string;
  amazonUploadScheduleHour: number;
  amazonUploadDailyLimit: number;
  amazonUploadMinCostUsd: number;
  amazonUploadMaxCostUsd: number;
  amazonUploadQuantity: number;
  amazonUploadAutoPublish: boolean;
  amazonAutoFulfill: boolean;
  amazonMarginUsPct: number | null;
  amazonMarginUkPct: number | null;
  amazonMarginAePct: number | null;
  amazonMarginSaPct: number | null;
}

const MARGIN_FIELD: Record<string, keyof AmazonSettings> = {
  us: "amazonMarginUsPct", uk: "amazonMarginUkPct", ae: "amazonMarginAePct", sa: "amazonMarginSaPct",
};

interface UploadLog {
  id: string;
  status: string;
  productsUploaded: number;
  productsSkipped: number;
  productsChecked: number;
  errorMessage: string | null;
  ranAt: string;
}

// Radar eşikleri — SADECE bilgilendirme. Gerçek radar mantığı Radar projesinde (urun-radari).
const RADAR_ROWS: Array<{ label: string; value: string }> = [
  { label: "Asgari kabul marjı", value: "%15" },
  { label: "Maks. BSR (talep eşiği)", value: (50000).toLocaleString("tr-TR") },
  { label: "Aylık min. satış", value: "30" },
  { label: "Maks. satıcı (rekabet)", value: "15" },
  { label: "AliExpress min. sipariş", value: "50" },
  { label: "AliExpress min. puan", value: "4.5" },
];

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50";
const selectCls = `${inputCls} cursor-pointer`;

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!on)}
      className="relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 flex-shrink-0"
      style={{ background: on ? AMZ_ACCENT : "rgba(255,255,255,0.15)" }}>
      <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(20px)" : "translateX(0)" }} />
    </button>
  );
}

function SectionTitle({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: AMZ_ACCENT }} /> {text}
    </h2>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ElementType }> = {
    success: { cls: "text-emerald-400 bg-emerald-500/10", label: "Başarılı", icon: CheckCircle2 },
    partial: { cls: "text-amber-400 bg-amber-500/10", label: "Kısmi", icon: Timer },
    failed: { cls: "text-red-400 bg-red-500/10", label: "Hata", icon: XCircle },
  };
  const s = map[status] ?? map.partial;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>
      <Icon className="h-3 w-3" /> {s.label}
    </span>
  );
}

const HOURLY_SCHEDULES = ["every_2h", "every_4h", "every_6h", "every_12h", "manual"];

export default function AmazonAutoUploadPage() {
  const [s, setS] = useState<AmazonSettings | null>(null);
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [logTotal, setLogTotal] = useState(0);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadSettings() {
    const r = await fetch("/api/amazon/settings");
    if (r.ok) setS(await r.json());
  }
  async function loadHistory() {
    const r = await fetch("/api/amazon/auto-upload/history");
    if (r.ok) {
      const d = await r.json();
      setLogs(d.logs ?? []);
      setLogTotal(d.total ?? 0);
    }
  }
  useEffect(() => { void loadSettings(); void loadHistory(); }, []);

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

  async function runNow() {
    setRunning(true);
    setMsg(null);
    try {
      const r = await fetch("/api/amazon/auto-upload/run", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? (j.message ?? "Oto-yükleme başlatıldı ✓") : (j.error ?? "Hata"));
      setTimeout(loadHistory, 1500);
    } finally {
      setRunning(false);
    }
  }

  const showHourPicker = s ? !HOURLY_SCHEDULES.includes(s.amazonUploadSchedule) : false;

  return (
    <>
      <PageHeader
        title="Oto Yükleme"
        subtitle="Depo kazananlarını kurallarına göre otomatik Amazon mağazana listeler."
        right={
          <div className="flex items-center gap-2">
            <button onClick={runNow} disabled={running}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold border flex items-center gap-1.5 disabled:opacity-50"
              style={{ borderColor: `${AMZ_ACCENT}55`, color: AMZ_ACCENT }}>
              <PlayCircle className="h-4 w-4" /> {running ? "Çalışıyor..." : "Şimdi Çalıştır"}
            </button>
            <button onClick={save} disabled={!s || saving}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-black flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: AMZ_ACCENT }}>
              <Save className="h-4 w-4" /> {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        }
      />

      {msg && <p className="text-sm text-slate-300 mb-4">{msg}</p>}

      <div className="grid lg:grid-cols-[5fr_7fr] gap-5">
        {/* ── SOL: ayarlar ── */}
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4" style={{ color: AMZ_ACCENT }} />
                <div>
                  <p className="text-sm font-bold">Otomatik Yükleme</p>
                  <p className="text-xs text-slate-400">Aktifken zamanlamana göre kendi kendine çalışır</p>
                </div>
              </div>
              <Toggle on={!!s?.amazonAutoUploadEnabled} disabled={!s} onChange={(v) => set("amazonAutoUploadEnabled", v)} />
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Clock} text="Zamanlama" />
            <div className={`grid ${showHourPicker ? "grid-cols-2" : "grid-cols-1"} gap-2`}>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Sıklık</label>
                <select className={selectCls} disabled={!s} value={s?.amazonUploadSchedule ?? "daily"}
                  onChange={(e) => set("amazonUploadSchedule", e.target.value)}>
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
                  <label className="text-xs text-slate-500 mb-1 block">Saat (UTC)</label>
                  <select className={selectCls} disabled={!s} value={s?.amazonUploadScheduleHour ?? 3}
                    onChange={(e) => set("amazonUploadScheduleHour", parseInt(e.target.value))}>
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{i}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Filter} text="Ürün Kriterleri" />
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Günlük Limit (ürün)</label>
                <input type="number" className={inputCls} disabled={!s} min={1} max={500}
                  value={s?.amazonUploadDailyLimit ?? ""}
                  onChange={(e) => set("amazonUploadDailyLimit", Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">AliExpress Min. Maliyet ($)</label>
                  <input type="number" className={inputCls} disabled={!s} min={0}
                    value={s?.amazonUploadMinCostUsd ?? ""}
                    onChange={(e) => set("amazonUploadMinCostUsd", Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Maks. Maliyet ($)</label>
                  <input type="number" className={inputCls} disabled={!s} min={0}
                    value={s?.amazonUploadMaxCostUsd ?? ""}
                    onChange={(e) => set("amazonUploadMaxCostUsd", Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Liste Adedi (qty)</label>
                <input type="number" className={inputCls} disabled={!s} min={1}
                  value={s?.amazonUploadQuantity ?? ""}
                  onChange={(e) => set("amazonUploadQuantity", Number(e.target.value))} />
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={UploadCloud} text="Yükleme Ayarları" />
            <label className="flex items-center gap-2.5 cursor-pointer text-sm mb-3">
              <input type="checkbox" checked={!!s?.amazonUploadAutoPublish} disabled={!s}
                onChange={(e) => set("amazonUploadAutoPublish", e.target.checked)}
                className="w-4 h-4" style={{ accentColor: AMZ_ACCENT }} />
              Otomatik Amazon&apos;a yayınla (kapalıysa taslak kalır)
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm">
              <input type="checkbox" checked={!!s?.amazonAutoFulfill} disabled={!s}
                onChange={(e) => set("amazonAutoFulfill", e.target.checked)}
                className="w-4 h-4" style={{ accentColor: AMZ_ACCENT }} />
              Satışta AliExpress&apos;e otomatik sipariş ver (oto-buy)
            </label>
          </Card>

          <Card>
            <SectionTitle icon={DollarSign} text="Pazar Başına Kâr Marjı" />
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              Boş bırakırsan pazarın varsayılanı kullanılır. Fiyat bu marja göre KDV ve gümrük dahil
              otomatik hesaplanır.
            </p>
            <div className="space-y-2">
              {MARKETS.map((m) => {
                const field = MARGIN_FIELD[m.key];
                const val = s ? (s[field] as number | null) : null;
                return (
                  <div key={m.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1">{m.name}</span>
                    <span className="text-xs text-slate-500 w-16 text-right">KDV %{Math.round(m.vatRate * 100)}</span>
                    <span className="text-xs text-slate-500 w-20 text-right">Gümrük %{Math.round(m.customsDutyRate * 100)}</span>
                    <input type="number" className="w-20 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-sm text-white text-right focus:outline-none focus:border-emerald-500/50"
                      disabled={!s} placeholder={`${Math.round(m.defaultMargin * 100)}`}
                      value={val ?? ""}
                      onChange={(e) => set(field, (e.target.value === "" ? null : Number(e.target.value)) as never)} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <SectionTitle icon={Tag} text="Mağazalar" />
            <a href="/amazon/stores"
              className="inline-block rounded-lg px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:border-emerald-500/40 transition-colors">
              Mağazalarım (bağla / yönet)
            </a>
            <p className="text-xs text-slate-500 mt-2">
              Pazar, mağaza bağlanırken otomatik tespit edilir. SP-API anahtarları bağlanınca yayın aktif olur.
            </p>
          </Card>

          <InfoCard title="Marka/yasak filtresi her zaman açık"
            text="Markalı ve yasaklı ürünler radar tarafından otomatik elenir; bu ayar kapatılamaz. SP-API bağlanınca yükleme öncesi getListingsRestrictions ile son bir kontrol daha yapılır." />

          <Card>
            <SectionTitle icon={ListChecks} text="Radar Eşikleri (bilgi amaçlı)" />
            <div className="divide-y divide-white/5">
              {RADAR_ROWS.map((r) => (
                <div key={r.label} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-400">{r.label}</span>
                  <span className="font-semibold" style={{ color: AMZ_ACCENT }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── SAĞ: yükleme geçmişi ── */}
        <div>
          <Card pad="p-0">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <SectionTitle icon={ListChecks} text="Yükleme Geçmişi" />
              <span className="text-xs text-slate-500">{logTotal} kayıt</span>
            </div>
            {!s ? (
              <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...
              </div>
            ) : logs.length === 0 ? (
              <div className="p-4">
                <Empty text="Henüz yükleme yapılmamış." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2 border-b border-white/5 font-semibold">Tarih</th>
                      <th className="text-left px-4 py-2 border-b border-white/5 font-semibold">Durum</th>
                      <th className="text-center px-4 py-2 border-b border-white/5 font-semibold">İncelenen</th>
                      <th className="text-center px-4 py-2 border-b border-white/5 font-semibold">Yüklenen</th>
                      <th className="text-center px-4 py-2 border-b border-white/5 font-semibold">Atlanan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(log.ranAt).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-2.5 text-center">{log.productsChecked}</td>
                        <td className="px-4 py-2.5 text-center font-semibold" style={{ color: AMZ_ACCENT }}>{log.productsUploaded}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500">{log.productsSkipped}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
