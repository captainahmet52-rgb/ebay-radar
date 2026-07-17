"use client";

import Link from "next/link";
import {
  Store, Warehouse, ShoppingCart, RefreshCcw, ArrowRight, Rocket,
} from "lucide-react";
import {
  PageHeader, Stat, Card, SHOPIFY_ACCENT, SHOPIFY_ACCENT2,
} from "@/components/shopify/shared";

export default function ShopifyOverviewPage() {
  return (
    <>
      <PageHeader
        title="ShopifyBot Paneli"
        subtitle="Shopify mağazanı bağla, ortak depodan ürün yükle — stok, fiyat ve siparişler otomatik takip edilir."
      />

      <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={Store} label="Mağaza" value={0} />
          <Stat icon={Warehouse} label="Yüklenen Ürün" value={0} />
          <Stat icon={ShoppingCart} label="Sipariş" value={0} />
          <Stat icon={RefreshCcw} label="Takipteki Ürün" value={0} />
        </div>

        <BuildingCard />
        <QuickNav />
      </div>
    </>
  );
}

function BuildingCard() {
  const steps = [
    { n: "1", t: "Mağazanı bağla", d: "Shopify mağazanı tek tıkla Lean Automation'a tanıt." },
    { n: "2", t: "Depodan ürün yükle", d: "Takipteki AliExpress ürünlerinden seç, Shopify'a yükle." },
    { n: "3", t: "Gerisi otomatik", d: "Stok bitti mi ürün kapanır, fiyat değişti mi güncellenir, siparişler panelde." },
  ];
  return (
    <div className="relative rounded-3xl overflow-hidden p-8 md:p-10"
      style={{
        background: "linear-gradient(180deg, rgba(14,20,10,0.7) 0%, rgba(6,10,6,0.85) 100%)",
        border: `1px solid ${SHOPIFY_ACCENT}26`,
        boxShadow: `0 0 60px ${SHOPIFY_ACCENT}12, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}>
      <div className="absolute -top-16 -right-10 w-64 h-64 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${SHOPIFY_ACCENT}33 0%, transparent 70%)`, filter: "blur(40px)" }} />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}40` }}>
          <Rocket className="h-7 w-7" style={{ color: SHOPIFY_ACCENT }} />
        </div>
        <h2 className="text-2xl font-black mb-2">Shopify otomasyonu kuruluyor</h2>
        <p className="text-slate-400 max-w-xl leading-relaxed mb-8">
          ShopifyBot şu an geliştirme aşamasında. Mağaza bağlama açıldığında akış şöyle işleyecek:
        </p>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                style={{ background: `linear-gradient(135deg,${SHOPIFY_ACCENT},${SHOPIFY_ACCENT2})` }}>
                {s.n}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">{s.t}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickNav() {
  const items = [
    { href: "/shopify/stores", label: "Mağazalar", desc: "Shopify mağazalarını bağla ve yönet.", icon: Store },
    { href: "/shopify/depot", label: "Depo", desc: "Takipteki ürünleri gör, Shopify'a yükle.", icon: Warehouse },
    { href: "/shopify/orders", label: "Siparişler", desc: "Gelen siparişleri takip et.", icon: ShoppingCart },
  ];
  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {items.map((it) => (
        <Link key={it.href} href={it.href}>
          <Card>
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33` }}>
                <it.icon className="h-5 w-5" style={{ color: SHOPIFY_ACCENT }} />
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
