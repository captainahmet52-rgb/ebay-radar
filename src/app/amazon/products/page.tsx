"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { PageHeader, Card, Empty, AMZ_ACCENT } from "@/components/amazon/shared";

interface AmazonListing {
  id: string; market: string; asin: string | null; sku: string | null;
  salePrice: number | null; currentQty: number; status: string; publishStage: string | null;
  product: { title: string | null; aliId: string };
}

const MARKET_SYMBOL: Record<string, string> = { us: "$", uk: "£", ae: "AED ", sa: "SAR " };
const STAGE_LABEL: Record<string, string> = {
  draft: "Taslak", published: "Yayında", error: "Hata",
};

export default function AmazonProductsPage() {
  const [data, setData] = useState<{ total: number; listings: AmazonListing[] } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/amazon/listings").then((r) => r.json()).catch(() => null);
    setData(d);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  return (
    <>
      <PageHeader
        title="Ürünler"
        subtitle="Amazon mağazalarına yüklenmiş listelemelerin."
        right={
          <button onClick={load} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm">
            <RefreshCw className="h-4 w-4" /> Yenile
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-3 text-slate-400 py-20 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...
        </div>
      ) : !data || data.listings.length === 0 ? (
        <Empty text="Henüz listeleme yok. Mağaza bağlayıp Ayarlar'dan oto-yüklemeyi açınca (ya da 'Şimdi yükle') depodan ürünler buraya listelenecek." />
      ) : (
        <div className="space-y-2.5">
          {data.listings.map((l) => {
            const sym = MARKET_SYMBOL[l.market] ?? "$";
            const active = l.status === "active";
            return (
              <Card key={l.id} pad="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{l.product.title ?? l.product.aliId}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {l.market.toUpperCase()} · {l.currentQty} adet
                      {l.salePrice != null ? ` · ${sym}${l.salePrice.toFixed(2)}` : ""}
                      {l.sku ? ` · SKU ${l.sku}` : ""}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={active
                        ? { background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}40`, color: AMZ_ACCENT }
                        : { background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>
                      {active ? "aktif" : l.status}
                    </span>
                    {l.publishStage && (
                      <p className="text-[10px] text-slate-500 mt-1">{STAGE_LABEL[l.publishStage] ?? l.publishStage}</p>
                    )}
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
