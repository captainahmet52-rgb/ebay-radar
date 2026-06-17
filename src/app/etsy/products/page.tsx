"use client";

import { Package } from "lucide-react";
import { EtsyReady, PageHeader, Card, Empty, StatusBadge } from "@/components/etsy/shared";

export default function EtsyProductsPage() {
  return (
    <>
      <PageHeader title="Ürünler" subtitle="Etsy ürün listelerin ve durumları." />
      <EtsyReady>
        {(data) =>
          data.products.length === 0 ? (
            <Empty text="Henüz ürün yok." />
          ) : (
            <div className="space-y-2">
              {data.products.map((p) => (
                <Card key={p.id} pad="p-3">
                  <div className="flex items-center gap-3">
                    {p.images?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        <Package className="h-5 w-5 text-slate-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{p.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {p.currency}
                        {p.tags?.length ? ` · ${p.tags.length} etiket` : ""}
                      </p>
                    </div>
                    {p.etsy_listing_id && (
                      <span className="text-[10px] font-medium text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
                        Etsy&apos;de
                      </span>
                    )}
                    <StatusBadge status={p.status} />
                  </div>
                </Card>
              ))}
            </div>
          )
        }
      </EtsyReady>
    </>
  );
}
