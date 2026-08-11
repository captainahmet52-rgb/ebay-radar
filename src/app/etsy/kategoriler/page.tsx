"use client";

import { useEffect, useState } from "react";
import { EtsyReady } from "@/components/etsy/shared";
import { ETSY_CATALOG } from "@/lib/etsy-catalog";
import { cn } from "@/lib/utils";
import type { EtsyProduct } from "@/types/etsyflow";
import type { CatalogPricingResponse } from "@/app/api/etsy/catalog-pricing/route";

const ETSY_FEE_RATE = 0.15;

// Referans görseller — henüz gerçek ürün üretilmemişken fallback (etsyflow-project/Categories.jsx'ten)
const REF: Record<string, string> = {
  "Crochet:Anahtarlık": "https://i.imgur.com/Unl1YIx.png",
  "Crochet:Amigurumi": "https://i.imgur.com/piIES0A.jpeg",
  "Crochet:Dönence": "https://i.imgur.com/OhQUVC0.png",
  "Punch Needle:Tek Taraflı Anahtarlık": "https://i.imgur.com/BylRW0J.jpeg",
  "Punch Needle:Broş": "https://i.imgur.com/U6fV6RE.jpeg",
  "Punch Needle:Bardak altlığı": "https://i.imgur.com/jlSdh1P.jpeg",
  "Punch Needle:Mousepad": "https://i.imgur.com/ksxNcs6.jpeg",
  "Punch Needle:Yastık kılıfı": "https://i.imgur.com/U8xprZx.jpeg",
  "3D:Figure": "https://i.imgur.com/W6wWsmS.png",
  "3D:Anahtarlık": "https://i.imgur.com/gximM00.jpeg",
  "3D:Kalemlik": "https://i.imgur.com/sBDDfOy.png",
  "3D:Saksı": "https://i.imgur.com/WxPvkv3.png",
  "3D:Diş fırçalığı": "https://i.imgur.com/5j2BqFX.png",
  "3D:Telefon standı": "https://i.imgur.com/AXITfpc.png",
  "3D:Araba parfümü": "https://i.imgur.com/5cQEEh0.png",
  "Tshirt:POD tasarımları": "https://i.imgur.com/I8XJvng.png",
  "Cam Saat:Farklı temalı iç tasarımlar": "https://i.imgur.com/VeEmrsh.jpeg",
  "Metal Wall Art:Metal Pano": "https://i.imgur.com/RHuivHX.jpeg",
};

/** EtsyFlow'un kendi Katalog sayfası (KODLAR/etsyflow-project/src/pages/dashboard/Categories.jsx) baz alındı. */
export default function EtsyKategorilerPage() {
  const [activeName, setActiveName] = useState(ETSY_CATALOG[0].name);
  const [pricing, setPricing] = useState<CatalogPricingResponse | null>(null);
  const activeCategory = ETSY_CATALOG.find((c) => c.name === activeName) ?? ETSY_CATALOG[0];

  useEffect(() => {
    fetch("/api/etsy/catalog-pricing")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPricing(d))
      .catch(() => setPricing(null));
  }, []);

  return (
    <EtsyReady>
      {(data) => {
        const productsIn = (category: string, sub: string) =>
          data.products.filter((p) => p.category === category && p.sub_category === sub);

        return (
          <div className="flex -m-6 lg:-m-8 min-h-[calc(100vh-0px)]">
            {/* İç Sidebar */}
            <aside className="w-[200px] flex-shrink-0 border-r border-[#1e293b] pt-5 pb-6 px-3">
              <p className="text-[10px] font-bold text-[#475569] uppercase tracking-widest mb-3 px-2">
                Alt Kategoriler
              </p>
              {ETSY_CATALOG.map((cat) => {
                const active = activeName === cat.name;
                return (
                  <button
                    key={cat.name}
                    onClick={() => setActiveName(cat.name)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition mb-0.5 text-left",
                      active
                        ? "bg-[#d4a054]/10 text-[#d4a054] border-l-2 border-[#d4a054]"
                        : "text-[#94a3b8] hover:text-[#e2e8f0] hover:bg-[#111827]"
                    )}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      {cat.name}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-bold px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0",
                        active ? "bg-[#d4a054] text-[#0a0e1a]" : "bg-[#1e293b] text-[#64748b]"
                      )}
                    >
                      {cat.subCategories.length}
                    </span>
                  </button>
                );
              })}
            </aside>

            {/* Ana İçerik */}
            <div className="flex-1 pt-5 pb-8 px-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#64748b]">Talep Üzerine Üretim</span>
                  <span className="text-[#334155]">›</span>
                  <span className="font-semibold text-[#f1f5f9]">{activeCategory.name}</span>
                </div>
                <span className="text-xs text-[#64748b] bg-[#111827] border border-[#1e293b] px-3 py-1 rounded-full">
                  {activeCategory.subCategories.length} ürün tipi
                </span>
              </div>

              <div key={activeName} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeCategory.subCategories.map((sub) => (
                  <ProductCard
                    key={sub}
                    category={activeCategory.name}
                    sub={sub}
                    products={productsIn(activeCategory.name, sub)}
                    pricing={pricing}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      }}
    </EtsyReady>
  );
}

function ProductCard({
  category,
  sub,
  products,
  pricing,
}: {
  category: string;
  sub: string;
  products: EtsyProduct[];
  pricing: CatalogPricingResponse | null;
}) {
  const key = `${category}:${sub}`;
  const refImg = REF[key] ?? null;
  const img1 = products[0]?.images?.[0] ?? refImg;
  const img2 = products[1]?.images?.[0] ?? refImg;

  const entry = pricing?.prices[key];
  const hasSalePrice = typeof entry?.salePrice === "number";
  const hasCost = typeof entry?.cost === "number";
  const salePrice = entry?.salePrice ?? 0;
  const cost = entry?.cost ?? 0;
  const etsyFee = +(salePrice * ETSY_FEE_RATE).toFixed(2);
  const netProfit = +(salePrice - cost - etsyFee).toFixed(2);

  return (
    <div className="bg-[#111827] border border-[#1e293b] rounded-2xl overflow-hidden flex flex-col hover:border-[#334155] transition-colors">
      {/* Görseller */}
      <div className="relative grid grid-cols-2 h-44">
        <ImageSlot src={img1} label="Satış" />
        <ImageSlot src={img2} label="Üretim" />
        {products.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#0c1322]/85 backdrop-blur-sm py-1.5 px-3 flex items-center gap-1.5">
            <span className="text-[#c08430] text-xs">◈</span>
            <span className="text-[11px] text-[#94a3b8] font-medium">Örnek Ürünler</span>
            <span className="text-[11px] text-[#d4a054] font-bold">({products.length})</span>
          </div>
        )}
      </div>

      {/* Bilgi */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <p className="text-sm font-bold text-[#f8fafc] leading-snug">{sub}</p>
          <p className="text-[11px] text-[#64748b] mt-0.5 flex items-center gap-1">
            <span className="text-[#c08430] text-[9px]">◆</span>
            {category}
          </p>
        </div>

        {/* Fiyat tablosu */}
        {hasSalePrice ? (
          <div className="bg-[#0c1322] rounded-xl p-3 space-y-1.5">
            <PriceRow label="Satış Fiyatı" value={`₺${salePrice.toFixed(2)}`} bold />
            <PriceRow label="Maliyet" value={hasCost ? `₺${cost.toFixed(2)}` : "Girilmedi"} muted={!hasCost} />
            <PriceRow label="Kargo" value="Hedefe göre değişir" muted italic />
            <PriceRow label={`Etsy (${(ETSY_FEE_RATE * 100).toFixed(0)}%)`} value={`₺${etsyFee.toFixed(2)}`} />
          </div>
        ) : (
          <div className="bg-[#0c1322] rounded-xl p-3 text-xs text-[#64748b] text-center py-4">
            Fiyat henüz admin panelden girilmedi.
          </div>
        )}

        {/* Net Kazanç */}
        {hasSalePrice && hasCost && (
          <div className="mt-auto bg-emerald-950/40 border border-emerald-900/40 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm font-bold">↗</span>
              <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wide">Net Kazanç</span>
            </div>
            <span className="text-emerald-400 text-base font-extrabold">₺{netProfit.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ImageSlot({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="relative overflow-hidden bg-[#1e293b] border-r border-[#334155] last:border-r-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-[#334155] text-2xl">◈</span>
        </div>
      )}
      <span
        className={cn(
          "absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full",
          label === "Satış"
            ? "bg-[#d4a054]/25 text-[#e8b56a] border border-[#d4a054]/40"
            : "bg-[#111827]/80 text-[#94a3b8] border border-[#334155]/60"
        )}
      >
        {label}
      </span>
    </div>
  );
}

function PriceRow({
  label,
  value,
  bold = false,
  italic = false,
  muted = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  italic?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-xs", bold ? "text-[#cbd5e1] font-medium" : "text-[#475569]")}>{label}</span>
      <span
        className={cn(
          "text-xs",
          bold ? "text-[#f1f5f9] font-semibold" : muted ? "text-[#475569]" : "text-[#64748b]",
          italic && "italic"
        )}
      >
        {value}
      </span>
    </div>
  );
}
