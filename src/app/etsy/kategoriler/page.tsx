"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Factory, Package, ArrowRight } from "lucide-react";
import { EtsyReady } from "@/components/etsy/shared";
import { Badge } from "@/components/etsy/ui";
import { ETSY_CATALOG } from "@/lib/etsy-catalog";
import { cn } from "@/lib/utils";
import type { EtsyProduct } from "@/types/etsyflow";

/**
 * listflow.pro "Kategoriler / Üretim Hatları" sayfası — sol panel kategori
 * listesi, sağ panel o kategorinin üretim hatları. Sayılar gerçek üretimden.
 */
export default function EtsyKategorilerPage() {
  const [activeName, setActiveName] = useState(ETSY_CATALOG[0].name);
  const activeCategory = ETSY_CATALOG.find((c) => c.name === activeName) ?? ETSY_CATALOG[0];

  return (
    <EtsyReady>
      {(data) => {
        const producedIn = (category: string, sub: string) =>
          data.products.filter((p) => p.category === category && p.sub_category === sub);

        return (
          <div className="flex min-h-screen">
            {/* Sol panel — kategori listesi */}
            <div className="w-[220px] flex-shrink-0 bg-[#0d0d14] border-r border-[#1e1e2e] flex flex-col">
              <div className="px-4 py-5 border-b border-[#1e1e2e]">
                <h2 className="text-xs font-semibold text-[#6b6b80] uppercase tracking-wider">
                  ÜRETİM HATLARI
                </h2>
              </div>
              <nav className="flex-1 overflow-y-auto py-2">
                {ETSY_CATALOG.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveName(cat.name)}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-all duration-200 group",
                      activeName === cat.name
                        ? "bg-[#8b5cf6]/10 text-[#8b5cf6] border-r-2 border-[#8b5cf6]"
                        : "text-[#a0a0b0] hover:text-white hover:bg-[#1e1e2e]/40"
                    )}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={cn(
                          "text-base flex-shrink-0 transition-transform duration-200",
                          activeName === cat.name ? "scale-110" : "group-hover:scale-110"
                        )}
                      >
                        {cat.icon}
                      </span>
                      <span className="truncate text-left">{cat.name}</span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 flex-shrink-0 transition-all duration-200",
                        activeName === cat.name
                          ? "text-[#8b5cf6] translate-x-0.5"
                          : "text-[#1e1e2e] group-hover:text-[#6b6b80]"
                      )}
                    />
                  </button>
                ))}
              </nav>
            </div>

            {/* Sağ panel — üretim hatları */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{activeCategory.icon}</span>
                  <h1 className="text-xl font-bold text-white">{activeCategory.name}</h1>
                </div>
                <p className="text-xs text-[#6b6b80] mb-6 uppercase tracking-wider">
                  {activeCategory.subCategories.length} ÜRETİM HATTI • {activeCategory.description}
                </p>

                <div key={activeName} className="flex flex-col gap-4">
                  {activeCategory.subCategories.map((sub) => (
                    <ProductionLineCard
                      key={sub}
                      category={activeCategory.name}
                      sub={sub}
                      products={producedIn(activeCategory.name, sub)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </EtsyReady>
  );
}

function ProductionLineCard({
  category,
  sub,
  products,
}: {
  category: string;
  sub: string;
  products: EtsyProduct[];
}) {
  const uploaded = products.filter((p) => p.upload_status === "uploaded").length;
  const waiting = products.filter((p) => p.upload_status === "waiting").length;
  const lastProduced = products.length
    ? new Date(
        Math.max(...products.map((p) => new Date(p.created_at).getTime()))
      ).toLocaleDateString("tr-TR")
    : null;

  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl overflow-hidden hover:border-[#8b5cf6]/30 transition-all duration-200">
      {/* Başlık */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center">
            <Factory className="w-4 h-4 text-[#8b5cf6]" />
          </div>
          <div className="text-sm font-semibold text-white">{sub}</div>
        </div>
        <Badge variant="success">HAT AKTİF</Badge>
      </div>

      {/* Metrikler */}
      <div className="px-5 py-4">
        <div className="grid grid-cols-4 gap-3 mb-4">
          <Metric label="ÜRETİLEN" value={String(products.length)} />
          <Metric label="ETSY'DE" value={String(uploaded)} valueClass="text-[#10b981]" />
          <Metric label="KUYRUKTA" value={String(waiting)} valueClass="text-yellow-400" />
          <Metric label="SON ÜRETİM" value={lastProduced ?? "—"} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 bg-[#12121a] rounded-lg px-4 py-2.5 border border-[#1e1e2e]">
            <Package className="w-4 h-4 text-[#6b6b80]" />
            <p className="text-xs text-[#a0a0b0]">
              {products.length === 0
                ? "Bu hatta henüz üretim yok — mağaza açınca otomasyon başlar."
                : `Bu hat için otomasyon ${products.length} ürün üretti.`}
            </p>
          </div>
          <Link
            href="/etsy/stores"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#06b6d4]/10 hover:bg-[#06b6d4]/20 border border-[#06b6d4]/30 text-[#06b6d4] text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            BU HATTA MAĞAZA AÇ
          </Link>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] text-[#6b6b80] uppercase tracking-wider mb-1">{label}</div>
      <div className={cn("text-sm font-semibold", valueClass)}>{value}</div>
    </div>
  );
}
