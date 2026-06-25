"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import type { FulfillmentStatus } from "@/types";

interface RecentOrder {
  id: string;
  asin: string;
  salePrice: number;
  netProfit: number;
  status: FulfillmentStatus;
  date: string;
}

interface RecentOrdersProps {
  orders?: RecentOrder[];
}

const container = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const item = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
};

export function RecentOrders({ orders = [] }: RecentOrdersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6"
    >
      <h3 className="text-sm font-medium text-slate-400 mb-4">Son Siparişler</h3>

      {orders.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-400">Henüz sipariş yok</p>
          <p className="text-xs text-slate-600 mt-1">İlk satışın burada görünecek</p>
        </div>
      ) : (
      <motion.div variants={container} initial="initial" animate="animate" className="space-y-3">
        {orders.map((order) => (
          <motion.div
            key={order.id}
            variants={item}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-between py-2.5 border-b border-slate-700/30 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono text-slate-300 truncate">{order.asin}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">#{order.id} · {order.date}</p>
            </div>
            <div className="flex items-center gap-3 ml-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-white">${order.salePrice.toFixed(2)}</p>
                <p className="text-[10px] text-emerald-400">+${order.netProfit.toFixed(2)}</p>
              </div>
              <Badge variant={order.status} />
            </div>
          </motion.div>
        ))}
      </motion.div>
      )}
    </motion.div>
  );
}
