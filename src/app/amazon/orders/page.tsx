"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Loader2, Wallet } from "lucide-react";
import { PageHeader, Card, Empty, AMZ_ACCENT } from "@/components/amazon/shared";

interface AmazonOrder {
  id: string;
  amazonOrderId: string;
  market: string;
  soldPrice: number | null;
  qty: number;
  aliTrackingNo: string | null;
  validCarrierCode: string | null;
  validTrackingNo: string | null;
  trackingStatus: string;
  status: string;
  createdAt: string;
}

interface OrdersResponse {
  balanceUsd: number;
  conversionFeeUsd: number;
  orders: AmazonOrder[];
}

export default function AmazonOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  async function load() {
    const r = await fetch("/api/amazon/orders");
    if (r.ok) setData(await r.json());
  }
  useEffect(() => { void load(); }, []);

  async function saveAli(orderId: string) {
    const aliTrackingNo = (drafts[orderId] ?? "").trim();
    if (!aliTrackingNo) return;
    setBusy(orderId);
    setMsg(null);
    try {
      const r = await fetch(`/api/amazon/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aliTrackingNo }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Hata");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(null);
    }
  }

  async function convert(orderId: string) {
    setBusy(orderId);
    setMsg(null);
    try {
      const r = await fetch(`/api/amazon/orders/${orderId}/convert-tracking`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) {
        if (j.needTopUp) setMsg("Yetersiz bakiye — kredi eklemek için destekle iletişime geç.");
        else setMsg(j.error ?? "Çevirme başarısız");
        return;
      }
      setMsg("Geçerli takip numarası oluşturuldu ✓");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Hata");
    } finally {
      setBusy(null);
    }
  }

  const fee = data?.conversionFeeUsd ?? 0.43;

  return (
    <>
      <PageHeader title="Siparişler" subtitle="Amazon siparişleri + AliExpress takip kodunu geçerli numaraya çevir." />

      {/* Cüzdan */}
      <div className="mb-5">
        <Card pad="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}33` }}>
                <Wallet className="h-5 w-5" style={{ color: AMZ_ACCENT }} />
              </div>
              <div>
                <p className="text-xs text-slate-400">Kredi bakiyesi</p>
                <p className="text-2xl font-black">${(data?.balanceUsd ?? 0).toFixed(2)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-500">
                Her çevirme: <b style={{ color: AMZ_ACCENT }}>${fee.toFixed(2)}</b>
              </p>
              <p className="text-xs text-slate-500">Kredi eklemek için destekle iletişime geç.</p>
            </div>
          </div>
        </Card>
      </div>

      {msg && <p className="text-sm text-slate-300 mb-3">{msg}</p>}

      {!data ? (
        <div className="flex items-center gap-3 text-slate-400 py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...
        </div>
      ) : data.orders.length === 0 ? (
        <Empty text="Henüz sipariş yok. Amazon siparişleri geldikçe burada listelenecek." />
      ) : (
        <div className="space-y-2.5">
          {data.orders.map((o, i) => (
            <motion.div key={o.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}>
            <Card pad="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">#{o.amazonOrderId}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {o.market.toUpperCase()} · {o.qty} adet
                    {o.soldPrice != null ? ` · ${o.soldPrice.toFixed(2)}` : ""} · {o.status}
                  </p>
                </div>

                {/* Geçerli numara hazırsa göster */}
                {o.validTrackingNo ? (
                  <div className="text-right">
                    <p className="text-[11px] text-slate-400">Geçerli takip ({o.validCarrierCode})</p>
                    <button
                      onClick={() => navigator.clipboard?.writeText(o.validTrackingNo!)}
                      className="inline-flex items-center gap-1.5 text-sm font-bold"
                      style={{ color: AMZ_ACCENT }}
                    >
                      {o.validTrackingNo} <Copy className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-[11px] text-slate-500 mt-0.5">Bu numarayı Amazon'a gir</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <input
                      placeholder="AliExpress takip no"
                      defaultValue={o.aliTrackingNo ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [o.id]: e.target.value }))}
                      className="w-44 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                    />
                    <button
                      onClick={() => saveAli(o.id)}
                      disabled={busy === o.id}
                      className="rounded-lg px-3 py-1.5 text-sm border border-white/10 text-white hover:border-emerald-500/40 disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => convert(o.id)}
                      disabled={busy === o.id || !o.aliTrackingNo}
                      title={!o.aliTrackingNo ? "Önce AliExpress numarasını kaydet" : `Çevir ($${fee.toFixed(2)})`}
                      className="rounded-lg px-4 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                      style={{ background: AMZ_ACCENT }}
                    >
                      {busy === o.id ? "..." : `Oluştur ($${fee.toFixed(2)})`}
                    </button>
                  </div>
                )}
              </div>
            </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );
}
