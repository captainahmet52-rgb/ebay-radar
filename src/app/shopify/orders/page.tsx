"use client";

import { useEffect, useState } from "react";
import { Loader2, ShoppingCart, AlertTriangle, ExternalLink } from "lucide-react";
import { PageHeader, InfoCard, Empty, SHOPIFY_ACCENT } from "@/components/shopify/shared";

interface OrderLineItem {
  title: string;
  quantity: number;
  listingId?: string;
  aliId?: string;
}

interface OrderRow {
  id: string;
  name: string;
  totalPrice: number;
  currency: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  lineItems: OrderLineItem[];
  sourcingStatus: string; // ok | ali_stock_risk | unlinked
  aliCostUsd: number | null;
  shopifyCreatedAt: string;
  shopifyAccount: { shopDomain: string };
}

const SOURCING_TEXT: Record<string, { label: string; color: string }> = {
  ok: { label: "Kaynak hazır", color: "#22c55e" },
  ali_stock_risk: { label: "AliExpress stok riski", color: "#f59e0b" },
  unlinked: { label: "Sistem dışı ürün", color: "#94a3b8" },
};

export default function ShopifyOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);

  useEffect(() => {
    fetch("/api/shopify/orders")
      .then((res) => (res.ok ? res.json() : { orders: [] }))
      .then((j) => setOrders(j.orders ?? []))
      .catch(() => setOrders([]));
  }, []);

  return (
    <>
      <PageHeader
        title="Siparişler"
        subtitle="Mağazalarına düşen siparişler — sistem her siparişte AliExpress kaynak durumunu (stok + maliyet) otomatik damgalar."
      />

      {orders === null ? (
        <div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      ) : orders.length === 0 ? (
        <div className="space-y-6 max-w-3xl">
          <Empty text="Henüz sipariş yok — mağazana sipariş düştüğünde en geç 30 dakika içinde burada görünür." />
          <InfoCard
            title="Sipariş akışı"
            text="Sipariş düştüğünde sistem, ortak depodaki güncel AliExpress verisiyle stok/maliyet kontrolü yapar. Kargo adresi gizlilik gereği burada tutulmaz — siparişi AliExpress'e verirken adresi kendi Shopify panelinden alırsın."
          />
        </div>
      ) : (
        <div className="space-y-3 max-w-4xl">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const sourcing = SOURCING_TEXT[order.sourcingStatus] ?? SOURCING_TEXT.unlinked;
  const date = new Date(order.shopifyCreatedAt).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33` }}
        >
          <ShoppingCart className="h-4.5 w-4.5" style={{ color: SHOPIFY_ACCENT }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {order.name}
            <span className="text-slate-500 font-normal text-xs ml-2">{order.shopifyAccount.shopDomain}</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">{date}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-black">
            {order.totalPrice.toFixed(2)} {order.currency}
          </p>
          {order.aliCostUsd !== null && (
            <p className="text-[11px] text-slate-500">Kaynak maliyeti ~${order.aliCostUsd.toFixed(2)}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge color={sourcing.color}>
          {order.sourcingStatus === "ali_stock_risk" && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
          {sourcing.label}
        </Badge>
        {order.financialStatus && <Badge color="#94a3b8">{prettyStatus(order.financialStatus)}</Badge>}
        {order.fulfillmentStatus && <Badge color="#94a3b8">{prettyStatus(order.fulfillmentStatus)}</Badge>}
      </div>

      {order.lineItems.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {order.lineItems.map((li, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <p className="text-xs text-slate-400 truncate flex-1">
                {li.quantity}× {li.title}
                {!li.listingId && <span className="text-slate-600"> (sistem dışı)</span>}
              </p>
              {li.aliId && (
                <a
                  href={`https://www.aliexpress.com/item/${li.aliId}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold rounded-lg px-2.5 py-1.5 flex-shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33`, color: SHOPIFY_ACCENT }}
                >
                  AliExpress&apos;te Sipariş Ver <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-medium rounded-full px-2 py-0.5"
      style={{ color, border: `1px solid ${color}55`, background: `${color}14` }}
    >
      {children}
    </span>
  );
}

function prettyStatus(s: string): string {
  const map: Record<string, string> = {
    PAID: "Ödendi",
    PENDING: "Ödeme bekliyor",
    REFUNDED: "İade edildi",
    PARTIALLY_REFUNDED: "Kısmi iade",
    FULFILLED: "Kargolandı",
    UNFULFILLED: "Kargo bekliyor",
    PARTIALLY_FULFILLED: "Kısmi kargo",
  };
  return map[s] ?? s.toLowerCase().replace(/_/g, " ");
}
