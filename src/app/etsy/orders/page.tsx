"use client";

import { ShoppingCart } from "lucide-react";
import { EtsyReady, PageHeader, Card, Empty, StatusBadge } from "@/components/etsy/shared";

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(s));
  } catch {
    return "—";
  }
}

export default function EtsyOrdersPage() {
  return (
    <>
      <PageHeader title="Siparişler" subtitle="Etsy mağazalarına gelen siparişler." />
      <EtsyReady>
        {(data) =>
          data.orders.length === 0 ? (
            <Empty text="Henüz sipariş yok." />
          ) : (
            <div className="space-y-2">
              {data.orders.map((o) => (
                <Card key={o.id} pad="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="h-5 w-5 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {o.buyer_name ?? "Alıcı"}{o.etsy_order_id ? ` · #${o.etsy_order_id}` : ""}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatDate(o.created_at)} · {o.currency}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
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
