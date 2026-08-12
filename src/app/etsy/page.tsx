"use client";

import { Package, Store, ShoppingCart, Clock, CheckCircle2 } from "lucide-react";
import { EtsyReady } from "@/components/etsy/shared";
import { PageHeader, Stat, Card, Empty } from "@/components/etsy/shared";
import type { EtsyOverview, EtsyStore } from "@/types/etsyflow";

const PLACEHOLDER =
  "data:image/svg+xml;base64," +
  (typeof window === "undefined"
    ? Buffer.from(
        '<svg width="36" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" fill="#292524"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#57534e" font-size="9" font-family="sans-serif">?</text></svg>'
      ).toString("base64")
    : btoa(
        '<svg width="36" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" fill="#292524"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#57534e" font-size="9" font-family="sans-serif">?</text></svg>'
      ));

function findStore(stores: EtsyStore[], id: string) {
  return stores.find((s) => s.id === id);
}

/** EtsyFlow'un kendi DashboardHome.jsx'i baz alındı (KODLAR/etsyflow-project). */
export default function EtsyDashboardPage() {
  return (
    <EtsyReady>
      {(data: EtsyOverview) => {
        const waiting = data.products.filter((p) => p.upload_status === "waiting").length;
        const uploaded = data.products.filter((p) => p.upload_status === "uploaded").length;
        const activeStores = data.stores.filter((s) => s.status === "active").length;
        const thisMonthOrders = data.orders.length;

        return (
          <div>
            <PageHeader title="Anasayfa" />

            {/* İstatistikler */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
              <Stat icon={Package} label="Toplam Ürün" value={data.products.length} />
              <Stat icon={Store} label="Aktif Mağaza" value={activeStores} />
              <Stat icon={ShoppingCart} label="Bu Ay Sipariş" value={thisMonthOrders} />
              <Stat icon={Clock} label="Yükleme Bekleyen" value={waiting} />
              <Stat icon={CheckCircle2} label="Etsy'ye Yüklenen" value={uploaded} />
            </div>

            {/* Mağaza Depoları */}
            {data.stores.length > 0 && (
              <Card pad="p-5">
                <h3 className="text-sm font-bold text-[#f5f5f4] mb-3">Mağaza Depoları</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.stores.map((store) => {
                    const storeProducts = data.products.filter((p) => p.store_id === store.id);
                    const storeWaiting = storeProducts.filter((p) => p.upload_status === "waiting").length;
                    const storeUploaded = storeProducts.filter((p) => p.upload_status === "uploaded").length;
                    return (
                      <div key={store.id} className="bg-[#0c0a09] border border-[#292524] rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-[#f5f5f4]">{store.name}</span>
                          {store.client_id && (
                            <span className="text-[10px] font-mono text-[#f1641e]/70">{store.client_id}</span>
                          )}
                        </div>
                        <div className="flex gap-4 text-xs">
                          <div>
                            <span className="text-[#78716c]">Toplam </span>
                            <span className="font-bold text-[#d6d3d1]">{storeProducts.length}</span>
                          </div>
                          <div>
                            <span className="text-[#78716c]">Bekleyen </span>
                            <span className="font-bold text-yellow-400">{storeWaiting}</span>
                          </div>
                          <div>
                            <span className="text-[#78716c]">Yüklenen </span>
                            <span className="font-bold text-green-400">{storeUploaded}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* İki kolon */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              {/* Son Ürünler */}
              <Card pad="p-5">
                <h3 className="text-sm font-bold text-[#f5f5f4] mb-4">Son Ürünler</h3>
                {data.products.length === 0 ? (
                  <Empty text="Henüz ürün yok." />
                ) : (
                  data.products.slice(0, 5).map((p) => (
                    <div
                      key={p.id}
                      className="flex justify-between items-center py-2.5 border-b border-[#292524]/30 last:border-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.images?.[0] || PLACEHOLDER}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-[#292524] flex-shrink-0 border border-[#44403c]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = PLACEHOLDER;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-[#f5f5f4] truncate max-w-[180px]">{p.title}</div>
                          <div className="text-[11px] text-[#78716c]">
                            {findStore(data.stores, p.store_id)?.name || "—"}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border flex-shrink-0 ${
                          p.upload_status === "uploaded"
                            ? "text-green-400 border-green-400/30"
                            : p.status === "error"
                              ? "text-red-400 border-red-400/30"
                              : "text-yellow-400 border-yellow-400/30"
                        }`}
                      >
                        {p.upload_status === "uploaded" ? "Yüklendi" : p.status === "error" ? "Hata" : "Bekliyor"}
                      </span>
                    </div>
                  ))
                )}
              </Card>

              {/* Son Siparişler */}
              <Card pad="p-5">
                <h3 className="text-sm font-bold text-[#f5f5f4] mb-4">Son Siparişler</h3>
                {data.orders.length === 0 ? (
                  <Empty text="Henüz sipariş yok." />
                ) : (
                  data.orders.slice(0, 5).map((o) => (
                    <div
                      key={o.id}
                      className="flex justify-between items-center py-2.5 border-b border-[#292524]/30 last:border-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-[#292524] flex items-center justify-center text-[10px] text-[#a8a29e] font-mono shrink-0">
                          #{o.etsy_order_id?.slice(-4) || "—"}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs text-[#f5f5f4] truncate">{o.buyer_name || "Müşteri"}</div>
                          <div className="text-[11px] text-[#78716c]">{findStore(data.stores, o.store_id)?.name}</div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-xs text-[#f1641e]">
                          {o.total ? `${o.total} ${o.currency || "TRY"}` : "—"}
                        </div>
                        <div className="text-[10px] text-[#78716c]">{o.status}</div>
                      </div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        );
      }}
    </EtsyReady>
  );
}
