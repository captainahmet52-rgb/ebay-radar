"use client";

import Link from "next/link";
import { Store, Package, ShoppingCart, TrendingUp, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  EtsyReady, PageHeader, Stat, Card, ETSY_ACCENT, ETSY_ACCENT2, useEtsyData,
} from "@/components/etsy/shared";

export default function EtsyOverviewPage() {
  return (
    <>
      <PageHeader
        title="EtsyBot Paneli"
        subtitle="Etsy mağaza, ürün ve siparişlerini tek panelden izle. Tüm veriler EtsyFlow ile canlı senkron."
      />
      <EtsyReady>
        {(data) => {
          const activeProducts = data.products.filter((p) => p.status === "active").length;
          const newOrders = data.orders.filter((o) => o.status === "new").length;
          const listed = data.products.filter((p) => p.etsy_listing_id).length;
          const isEmpty = data.stores.length === 0 && data.products.length === 0;

          return (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={Store} label="Mağaza" value={data.stores.length} sub={`${data.stores.filter((s) => s.status === "active").length} aktif`} />
                <Stat icon={Package} label="Ürün" value={data.products.length} sub={`${activeProducts} aktif`} />
                <Stat icon={ShoppingCart} label="Sipariş" value={data.orders.length} sub={`${newOrders} yeni`} />
                <Stat icon={TrendingUp} label="Aktif Listeleme" value={listed} />
              </div>

              {isEmpty ? <EmptyOnboarding /> : <QuickNav />}
            </div>
          );
        }}
      </EtsyReady>
    </>
  );
}

function QuickNav() {
  const items = [
    { href: "/etsy/stores", label: "Mağazalar", desc: "Etsy mağazalarını gör ve yönet.", icon: Store },
    { href: "/etsy/products", label: "Ürünler", desc: "Ürün listelerini ve durumlarını izle.", icon: Package },
    { href: "/etsy/orders", label: "Siparişler", desc: "Gelen siparişleri takip et.", icon: ShoppingCart },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <Link key={it.href} href={it.href}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${ETSY_ACCENT}1a`, border: `1px solid ${ETSY_ACCENT}33` }}>
                <it.icon className="h-5 w-5" style={{ color: ETSY_ACCENT }} />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500" />
            </div>
            <p className="font-semibold text-sm mt-3">{it.label}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{it.desc}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function EmptyOnboarding() {
  const { email } = useEtsyData();
  const steps = [
    { n: "1", t: "Mağaza ekle", d: "Etsy mağazanı sisteme tanıt." },
    { n: "2", t: "Ürünleri yükle", d: "Ürünlerini ekle, kategorilere ayır." },
    { n: "3", t: "Otomatik takip", d: "Sipariş, stok ve listelemeler burada izlenir." },
  ];
  return (
    <div className="relative rounded-3xl overflow-hidden p-8 md:p-10"
      style={{
        background: "linear-gradient(180deg, rgba(20,14,10,0.7) 0%, rgba(8,6,10,0.85) 100%)",
        border: `1px solid ${ETSY_ACCENT}26`,
        boxShadow: `0 0 60px ${ETSY_ACCENT}12, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
      <div className="absolute -top-16 -right-10 w-64 h-64 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ETSY_ACCENT}33 0%, transparent 70%)`, filter: "blur(40px)" }} />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${ETSY_ACCENT}1a`, border: `1px solid ${ETSY_ACCENT}40` }}>
          <Store className="h-7 w-7" style={{ color: ETSY_ACCENT }} />
        </div>
        <h2 className="text-2xl font-black mb-2">Etsy verilerin burada görünecek</h2>
        <p className="text-slate-400 max-w-xl leading-relaxed mb-8">
          Bu hesapta henüz Etsy verisi yok. Mağazan eklendiğinde ürünlerin, siparişlerin ve
          otomasyonun bu panelde otomatik görünür.
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg,${ETSY_ACCENT},${ETSY_ACCENT2})` }}>
                {s.n}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">{s.t}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
        {email && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-8">
            <CheckCircle2 className="h-3.5 w-3.5" style={{ color: ETSY_ACCENT }} />
            <span><span className="text-slate-300">{email}</span> hesabıyla EtsyFlow verilerine bağlısın.</span>
          </p>
        )}
      </div>
    </div>
  );
}
