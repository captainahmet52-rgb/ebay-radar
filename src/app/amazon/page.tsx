"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar, Package, ShoppingCart, Gauge, ArrowRight, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { PageHeader, Stat, Card, AMZ_ACCENT } from "@/components/amazon/shared";

interface DepotProduct {
  id: string; aliId: string; title: string | null; category: string | null;
  radarScore: number | null; aliCostUsd: number; status: string;
}

export default function AmazonPanelPage() {
  const [depot, setDepot] = useState<{ total: number; active: number; paused: number; products: DepotProduct[] } | null>(null);
  const [listingsCount, setListingsCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [d, l, o] = await Promise.all([
      fetch("/api/amazon/depot").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/listings").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/orders").then((r) => r.json()).catch(() => null),
    ]);
    setDepot(d);
    setListingsCount(l?.total ?? 0);
    setOrdersCount(o?.orders?.length ?? 0);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const winners = depot?.products.filter((p) => p.status === "active") ?? [];
  const avgScore = winners.length
    ? Math.round(winners.reduce((s, p) => s + (p.radarScore ?? 0), 0) / winners.length)
    : 0;

  return (
    <>
      <PageHeader
        title="AmazonBot Paneli"
        subtitle="Radar AliExpress'ten kazanan ürünleri bulur, marka/yasak + kâr filtresinden geçirip depoya yazar."
        right={
          <button onClick={load} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-24 justify-center">
          <Loader2 className="h-6 w-6 animate-spin" /> Yükleniyor...
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={Radar} label="Depodaki ürün" value={depot?.active ?? 0} sub={`toplam ${depot?.total ?? 0}`} />
            <Stat icon={Package} label="Listelemelerim" value={listingsCount} />
            <Stat icon={ShoppingCart} label="Siparişler" value={ordersCount} />
            <Stat icon={Gauge} label="Ort. radar skoru" value={avgScore} sub="/100" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Depodaki en iyi ürünler</h2>
              <Link href="/amazon/depot" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                Tümü <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {winners.length === 0 ? (
              <p className="text-slate-500 text-sm py-10 text-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
                Depo henüz boş. AliExpress API bağlanınca radar otomatik doldurmaya başlar
                (admin&apos;den elle de tetikleyebilirsin).
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {winners.slice(0, 6).map((p) => (
                  <Card key={p.id}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}40`, color: AMZ_ACCENT }}>
                        {p.radarScore ?? 0}/100
                      </span>
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium leading-snug line-clamp-2">{p.title ?? p.aliId}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Maliyet ${p.aliCostUsd.toFixed(2)}{p.category ? ` · ${p.category}` : ""}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
