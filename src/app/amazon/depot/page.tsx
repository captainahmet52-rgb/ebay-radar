"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, PauseCircle, Loader2, RefreshCw } from "lucide-react";
import { PageHeader, Card, Empty, AMZ_ACCENT } from "@/components/amazon/shared";

interface DepotProduct {
  id: string; aliId: string; title: string | null; category: string | null; brand: string | null;
  radarScore: number | null; aliCostUsd: number; aliShippingUsd: number;
  aliOrders: number; aliRating: number; amazonBsr: number | null;
  aliStockStatus: string; status: string;
}

export default function AmazonDepotPage() {
  const [data, setData] = useState<{ demo: boolean; total: number; active: number; paused: number; products: DepotProduct[] } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/amazon/depot").then((r) => r.json()).catch(() => null);
    setData(d);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  return (
    <>
      <PageHeader
        title="Radar & Depo"
        subtitle="Radar AliExpress'ten kazanan ürünleri bulur, marka/yasak + kâr filtresinden geçirip depoya yazar. Stok kontrol bunları tarar."
        right={
          <button onClick={load} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
        }
      />

      {data?.demo && (
        <div className="mb-5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(210,153,34,0.08)", border: "1px solid rgba(210,153,34,0.3)", color: "#e3b341" }}>
          ⚠️ <b>DEMO veri</b> — Bu ürünler örnektir, gerçek AliExpress ürünü değildir. AliExpress API
          bağlanınca radar gerçek ürünleri bulup buraya yazacak.
        </div>
      )}

      {data && (
        <div className="flex gap-3 mb-5 text-sm">
          <span className="px-3 py-1 rounded-lg" style={{ background: `${AMZ_ACCENT}14`, color: AMZ_ACCENT }}>
            Aktif: {data.active}
          </span>
          <span className="px-3 py-1 rounded-lg bg-white/5 text-slate-400">Duraklatılmış: {data.paused}</span>
          <span className="px-3 py-1 rounded-lg bg-white/5 text-slate-400">Toplam: {data.total}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-20 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Depo yükleniyor...
        </div>
      ) : !data || data.products.length === 0 ? (
        <Empty text="Depo henüz boş. AliExpress API bağlanınca radar otomatik doldurur; admin panelinden elle de tetikleyebilirsin (Amazon Radar → Çalıştır)." />
      ) : (
        <div className="space-y-2.5">
          {data.products.map((p) => {
            const active = p.status === "active";
            return (
              <Card key={p.id} pad="p-4">
                <div className="flex items-start gap-3">
                  {active ? (
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
                  ) : (
                    <PauseCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-400/80" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{p.title ?? p.aliId}</p>
                      {p.radarScore != null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}40`, color: AMZ_ACCENT }}>
                          {p.radarScore}/100
                        </span>
                      )}
                      {!active && <span className="text-[10px] text-amber-400">duraklatıldı</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Maliyet ${p.aliCostUsd.toFixed(2)} + kargo ${p.aliShippingUsd.toFixed(2)}
                      {p.category ? ` · ${p.category}` : ""} · {p.aliOrders} sipariş · ⭐{p.aliRating}
                      {p.amazonBsr ? ` · BSR ${p.amazonBsr}` : ""} · stok: {p.aliStockStatus}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
