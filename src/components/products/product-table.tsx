"use client";

import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Trash2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PollTier, StockStatus, ListingStatus } from "@/types";

export interface Product {
  id: string;
  asin: string;
  title: string;
  category: string;
  amazonPrice: number;
  ebayPrice: number;
  ebayFeeRate: number;
  amazonStockStatus: StockStatus;
  status: ListingStatus;
  pollTier: PollTier;
  lastScrapedAt: string;
}

interface ProductTableProps {
  products: Product[];
  loading?: boolean;
  onRefresh?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onAddProduct?: () => void;
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

function netProfitPct(amazonPrice: number, ebayPrice: number, feeRate: number): number {
  const fee = ebayPrice * feeRate + 0.4;
  const profit = ebayPrice - amazonPrice - fee;
  return (profit / ebayPrice) * 100;
}

const stockBadgeVariant = (s: StockStatus) =>
  s === "in_stock" ? "active" : s === "low" ? "paused" : "out";
const stockLabel: Record<StockStatus, string> = {
  in_stock: "Bol Stok",
  low:      "Az Kaldı",
  out:      "Tükendi",
  unknown:  "Bilinmiyor",
};
const tierBadge = { hot: "hot", normal: "normal", dead: "dead" } as const;
const statusBadge = { active: "active", paused: "paused", ended: "out" } as const;

export function ProductTable({
  products,
  loading = false,
  onRefresh,
  onDelete,
  onAddProduct,
}: ProductTableProps) {
  if (!loading && products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center">
          <Package className="h-8 w-8 text-slate-500" />
        </div>
        <div className="text-center">
          <p className="text-slate-300 font-medium">Henüz ürün yok</p>
          <p className="text-sm text-slate-500 mt-1">İlk ürününüzü ekleyerek başlayın.</p>
        </div>
        <Button onClick={onAddProduct} size="md">
          Ürün Ekle
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-900/60">
            {["ASIN", "Başlık", "Amazon $", "eBay $", "Kâr %", "Stok", "Tier", "Durum", "Eylemler"].map(
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
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : products.map((p, index) => {
                const profitPct = netProfitPct(p.amazonPrice, p.ebayPrice, p.ebayFeeRate);
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group transition-all duration-200",
                      "hover:bg-white/[0.02] hover:shadow-lg hover:shadow-violet-500/5"
                    )}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-violet-400 bg-violet-500/10 px-2 py-1 rounded-lg">
                        {p.asin}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="text-slate-200 truncate text-xs">{p.title}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{p.category}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-300 font-mono text-xs">
                      ${p.amazonPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-white font-mono text-xs font-semibold">
                      ${p.ebayPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          profitPct >= 20 ? "text-emerald-400" : profitPct >= 10 ? "text-amber-400" : "text-red-400"
                        )}
                      >
                        %{profitPct.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={stockBadgeVariant(p.amazonStockStatus)}>
                        {stockLabel[p.amazonStockStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={tierBadge[p.pollTier]} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge[p.status]} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onRefresh && (
                          <button
                            onClick={() => onRefresh(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                            title="Yenile"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(p.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
