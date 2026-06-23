"use client";
import { useState } from "react";
import useSWR from "swr";

interface ShipTo {
  name: string | null; line1: string | null; line2: string | null;
  city: string | null; state: string | null; zip: string | null;
  country: string | null; phone: string | null;
}
interface FOrder {
  id: string;
  ebayOrderId: string | null;
  managedStatus: string;
  soldPrice: number | null;
  sourceCostUsd: number | null;
  markupUsd: number;
  amazonTrackingNo: string | null;
  trackingNumber: string | null;
  asin: string | null;
  title: string | null;
  amazonUrl: string | null;
  store: string | null;
  userEmail: string | null;
  userBalance: number;
  shipTo: ShipTo;
  createdAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ data: FOrder[]; defaultMarkup: number }>;

const STATUS_LABEL: Record<string, string> = {
  awaiting_admin: "🔵 Admin: Amazon'dan al + bilgileri gir",
  awaiting_order_payment: "🟡 Kullanıcı sipariş ödemesi bekleniyor",
  awaiting_tracking_payment: "🟠 Kullanıcı takip ödemesi bekleniyor",
  awaiting_ebay_push: "🟢 Takip üretildi — kullanıcı eBay'e gönderecek",
  completed: "✅ Tamamlandı — eBay'e yüklendi",
};

function addrText(s: ShipTo): string {
  return [s.name, s.line1, s.line2, [s.city, s.state, s.zip].filter(Boolean).join(" "), s.country, s.phone]
    .filter(Boolean).join(", ");
}

export default function AdminFulfillmentPage() {
  const { data, mutate, isLoading } = useSWR("/api/admin/fulfillment", fetcher, { refreshInterval: 30000 });
  const orders = data?.data ?? [];
  const [forms, setForms] = useState<Record<string, { cost: string; markup: string; tracking: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  function setF(id: string, k: "cost" | "markup" | "tracking", v: string) {
    setForms((p) => {
      const cur = p[id] ?? { cost: "", markup: String(data?.defaultMarkup ?? 5), tracking: "" };
      return { ...p, [id]: { ...cur, [k]: v } };
    });
  }

  async function submit(o: FOrder) {
    const f = forms[o.id] ?? { cost: "", markup: String(o.markupUsd), tracking: "" };
    if (!f.cost || Number.isNaN(Number(f.cost))) { alert("Amazon maliyeti gir"); return; }
    setBusy(o.id);
    try {
      const res = await fetch("/api/admin/fulfillment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: o.id,
          sourceCostUsd: Number(f.cost),
          markupUsd: f.markup ? Number(f.markup) : undefined,
          amazonTrackingNo: f.tracking || undefined,
        }),
      });
      if (res.ok) mutate();
      else alert((await res.json()).error ?? "Hata");
    } finally {
      setBusy(null);
    }
  }

  function copy(t: string) { navigator.clipboard.writeText(t); }

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold mb-1">Sipariş Havuzu (Managed Fulfillment)</h1>
      <p className="text-sm text-slate-400 mb-5">
        Sipariş gelir → adresi al, Amazon&apos;dan o adrese sipariş ver → maliyet + Amazon takip no gir.
        Sonra kullanıcı öder; takip ödeyince sistem TrackCaptain&apos;dan geçerli no üretip eBay&apos;e yükler.
      </p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : orders.length === 0 ? (
        <p className="text-slate-500 text-sm">Bekleyen sipariş yok. 🎉</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/60 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-semibold text-sm">{o.title ?? o.asin ?? "—"}</p>
                  <p className="text-xs text-slate-400">
                    Satış: ${o.soldPrice?.toFixed(2) ?? "—"} · Mağaza: {o.store ?? "—"} · {o.userEmail} (bakiye ${o.userBalance.toFixed(2)})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{STATUS_LABEL[o.managedStatus] ?? o.managedStatus}</p>
                </div>
                {o.amazonUrl && (
                  <a href={o.amazonUrl} target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 whitespace-nowrap hover:bg-amber-500/30">
                    Amazon&apos;da Aç ↗
                  </a>
                )}
              </div>

              {/* Alıcı adresi */}
              <div className="text-xs bg-slate-800/60 rounded-lg p-2.5 flex items-start justify-between gap-2">
                <span className="text-slate-300">📦 {addrText(o.shipTo) || "Adres yok (eBay'den gelmedi)"}</span>
                {addrText(o.shipTo) && (
                  <button onClick={() => copy(addrText(o.shipTo))} className="text-violet-400 hover:underline whitespace-nowrap">Kopyala</button>
                )}
              </div>

              {/* Admin formu — sadece awaiting_admin'de */}
              {o.managedStatus === "awaiting_admin" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Amazon maliyeti ($)</label>
                    <input type="number" value={forms[o.id]?.cost ?? ""} onChange={(e) => setF(o.id, "cost", e.target.value)}
                      className="w-28 bg-slate-800 border border-slate-700/50 rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Markup ($)</label>
                    <input type="number" value={forms[o.id]?.markup ?? String(o.markupUsd)} onChange={(e) => setF(o.id, "markup", e.target.value)}
                      className="w-20 bg-slate-800 border border-slate-700/50 rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Amazon takip no</label>
                    <input value={forms[o.id]?.tracking ?? ""} onChange={(e) => setF(o.id, "tracking", e.target.value)}
                      className="w-44 bg-slate-800 border border-slate-700/50 rounded px-2 py-1.5 text-sm font-mono" />
                  </div>
                  <button onClick={() => submit(o)} disabled={busy === o.id}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-50">
                    {busy === o.id ? "…" : "Kullanıcıya Gönder"}
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-400">
                  Maliyet: ${o.sourceCostUsd?.toFixed(2)} + markup ${o.markupUsd.toFixed(2)} · Amazon takip: {o.amazonTrackingNo ?? "—"}
                  {o.trackingNumber && <> · ✅ eBay takip: <span className="font-mono text-emerald-400">{o.trackingNumber}</span></>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
