"use client";

import { Store } from "lucide-react";
import { EtsyReady, PageHeader, Card, Empty, StatusBadge, ETSY_ACCENT } from "@/components/etsy/shared";

export default function EtsyStoresPage() {
  return (
    <>
      <PageHeader title="Mağazalar" subtitle="Etsy mağazaların — EtsyFlow ile canlı senkron." />
      <EtsyReady>
        {(data) =>
          data.stores.length === 0 ? (
            <Empty text="Henüz mağaza yok." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.stores.map((s) => (
                <Card key={s.id}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${ETSY_ACCENT}1a`, border: `1px solid ${ETSY_ACCENT}33` }}>
                      <Store className="h-5 w-5" style={{ color: ETSY_ACCENT }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{s.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {s.category ?? "—"}{s.sub_category ? ` · ${s.sub_category}` : ""} · {s.currency}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
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
