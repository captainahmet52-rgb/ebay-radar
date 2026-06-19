"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Package, ShoppingCart, AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { PageHeader, Stat, Card, AMZ_ACCENT } from "@/components/amazon/shared";

interface Listing {
  id: string; market: string; salePrice: number | null; currentQty: number;
  status: string; publishStage: string | null;
  product: { title: string | null; aliId: string };
}

const MARKET_SYMBOL: Record<string, string> = { us: "$", uk: "£", ae: "AED ", sa: "SAR " };

export default function AmazonPanelPage() {
  const [accounts, setAccounts] = useState(0);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsCount, setListingsCount] = useState(0);
  const [orders, setOrders] = useState(0);
  const [riskOrders, setRiskOrders] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [acc, l, o] = await Promise.all([
      fetch("/api/amazon/accounts").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/listings").then((r) => r.json()).catch(() => null),
      fetch("/api/amazon/orders").then((r) => r.json()).catch(() => null),
    ]);
    setAccounts(acc?.data?.length ?? 0);
    setListings(l?.listings ?? []);
    setListingsCount(l?.total ?? 0);
    const ords = o?.orders ?? [];
    setOrders(ords.length);
    setRiskOrders(ords.filter((x: { status: string }) => x.status === "risk").length);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  return (
    <>
      <PageHeader
        title="AmazonBot Paneli"
        subtitle="Mağazanı bağla, kurallarını ayarla — sistem depodan uygun ürünleri otomatik listeler, fiyatlar ve siparişleri yönetir."
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
            <Stat icon={Store} label="Mağazalarım" value={accounts} />
            <Stat icon={Package} label="Listelemelerim" value={listingsCount} />
            <Stat icon={ShoppingCart} label="Siparişler" value={orders} />
            <Stat icon={AlertTriangle} label="Riskli sipariş" value={riskOrders} sub="kontrol et" />
          </div>

          {accounts === 0 && (
            <Card>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-slate-300">
                  Başlamak için bir Amazon mağazası bağla — sonra Ayarlar&apos;dan oto-yüklemeyi aç.
                </p>
                <Link href="/amazon/stores" className="rounded-lg px-4 py-2 text-sm font-semibold text-black flex items-center gap-1.5"
                  style={{ background: AMZ_ACCENT }}>
                  Mağaza bağla <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Son listelemelerim</h2>
              <Link href="/amazon/products" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                Tümü <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {listings.length === 0 ? (
              <p className="text-slate-500 text-sm py-10 text-center rounded-xl"
                style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
                Henüz listeleme yok. Mağaza bağlayıp oto-yüklemeyi açınca ürünler otomatik listelenecek.
              </p>
            ) : (
              <div className="space-y-2.5">
                {listings.slice(0, 6).map((l) => {
                  const sym = MARKET_SYMBOL[l.market] ?? "$";
                  return (
                    <Card key={l.id}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-sm font-medium min-w-0">{l.product.title ?? l.product.aliId}</p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {l.market.toUpperCase()}{l.salePrice != null ? ` · ${sym}${l.salePrice.toFixed(2)}` : ""} · {l.status}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
