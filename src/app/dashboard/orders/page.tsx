"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { FulfillmentStatus } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Order {
  id: string;
  ebayOrderId?: string;
  soldPrice: number;
  amazonPrice?: number;
  netProfit?: number;
  fulfillmentStatus: FulfillmentStatus;
  verifiedAt?: string;
  createdAt: string;
  listing?: {
    product?: {
      asin: string;
      title: string;
    };
  };
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function OrdersPage() {
  const { data: orders, isLoading } = useSWR<Order[]>("/api/orders", fetcher);
  const { data: stats } = useSWR("/api/orders/stats", fetcher);

  const safeOrders = orders ?? [];
  const totalProfit = safeOrders.reduce((sum, o) => sum + (o.netProfit ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Siparişler</h1>
          <p className="text-sm text-slate-400 mt-1">Tüm eBay siparişleri</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5"
        >
          <p className="text-sm text-slate-400">Toplam Sipariş</p>
          <p className="text-2xl font-bold text-white mt-1">{stats?.totalOrders ?? safeOrders.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5"
        >
          <p className="text-sm text-slate-400">Toplam Kâr</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            ${(stats?.totalProfit ?? totalProfit).toFixed(2)}
          </p>
        </motion.div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/60">
                {["eBay Sipariş ID", "Ürün", "Satış $", "Amazon $", "Net Kâr", "Durum", "Tarih"].map(
                  (col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : safeOrders.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-slate-400">
                      Henüz sipariş yok.
                    </td>
                  </tr>
                )
                : safeOrders.map((order, index) => (
                  <motion.tr
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-300">
                        {order.ebayOrderId ?? `#${order.id.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-violet-400">
                        {order.listing?.product?.asin ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 max-w-[160px] truncate">
                        {order.listing?.product?.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold font-mono text-xs">
                      ${order.soldPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      {order.amazonPrice ? `$${order.amazonPrice.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-emerald-400">
                        {order.netProfit != null ? `+$${order.netProfit.toFixed(2)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={order.fulfillmentStatus} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDate(order.createdAt)}
                    </td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
