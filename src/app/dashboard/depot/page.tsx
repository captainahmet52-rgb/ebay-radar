"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { Package } from "lucide-react";

interface DepotProduct {
  id: string;
  asin: string;
  title: string | null;
  amazonPrice: number | null;
  calculatedEbayPrice: number | null;
  imageUrl: string | null;
  status: string;
}

interface DistributionItem {
  id: string;
  distributedAt: string;
  depotProduct: DepotProduct;
  listing: { id: string; status: string } | null;
}

interface DepotMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  productLimit: number;
  used: number;
  remaining: number;
}

interface DepotResponse {
  data: DistributionItem[];
  meta: DepotMeta;
}

const fetcher = (url: string) => fetch(url).then(r => r.json()) as Promise<DepotResponse>;

export default function DepotPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSWR<DepotResponse>(
    `/api/depot?page=${page}&limit=20`,
    fetcher
  );

  const meta = data?.meta;
  const usedPct = meta ? Math.min(100, Math.round((meta.used / meta.productLimit) * 100)) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Baslik */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-violet-500/20 rounded-xl">
            <Package className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Urun Depom</h1>
            <p className="text-slate-400 text-sm">
              Size otomatik dagitilan urunler
            </p>
          </div>
        </div>

        {/* Limit gostergesi */}
        {meta && (
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-300 text-sm font-medium">Urun Kullanimi</span>
              <span className="text-slate-400 text-sm">
                {meta.used} / {meta.productLimit} urun
              </span>
            </div>
            <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  usedPct >= 90
                    ? "bg-red-500"
                    : usedPct >= 70
                    ? "bg-amber-500"
                    : "bg-violet-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${usedPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-slate-500 text-xs">%{usedPct} kullanildi</span>
              <span className="text-slate-500 text-xs">{meta.remaining} urun kaldi</span>
            </div>
          </div>
        )}

        {/* Urun tablosu */}
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400">Yukleniyor...</div>
          ) : !data?.data.length ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Henuz urun dagitilmadi.</p>
              <p className="text-slate-500 text-sm mt-1">
                Sistem urenleri otomatik olarak dagitacak.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400">
                  <th className="text-left p-4">Urun</th>
                  <th className="text-left p-4">ASIN</th>
                  <th className="text-right p-4">Amazon</th>
                  <th className="text-right p-4">eBay Fiyati</th>
                  <th className="text-right p-4">Durum</th>
                  <th className="text-right p-4">Dagitim</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((item, i) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-slate-800/50 hover:bg-slate-800/20"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.depotProduct.imageUrl ? (
                          <img
                            src={item.depotProduct.imageUrl}
                            alt={item.depotProduct.title ?? ""}
                            className="w-10 h-10 object-cover rounded-lg bg-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center">
                            <Package className="w-5 h-5 text-slate-500" />
                          </div>
                        )}
                        <span className="text-slate-200 max-w-xs truncate">
                          {item.depotProduct.title ?? "Baslik yok"}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-violet-300 text-xs">
                      {item.depotProduct.asin}
                    </td>
                    <td className="p-4 text-right text-slate-300">
                      {item.depotProduct.amazonPrice != null
                        ? `$${item.depotProduct.amazonPrice.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="p-4 text-right text-emerald-400 font-medium">
                      {item.depotProduct.calculatedEbayPrice != null
                        ? `$${item.depotProduct.calculatedEbayPrice.toFixed(2)}`
                        : "-"}
                    </td>
                    <td className="p-4 text-right">
                      {item.listing ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            item.listing.status === "active"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-amber-500/20 text-amber-400"
                          }`}
                        >
                          {item.listing.status === "active" ? "Listelendi" : "Duraklatildi"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/40 text-slate-400">
                          Listede degil
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right text-slate-500 text-xs">
                      {new Date(item.distributedAt).toLocaleDateString("tr-TR")}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sayfalama */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl text-sm disabled:opacity-40 transition-colors"
            >
              Onceki
            </button>
            <span className="text-slate-400 text-sm">
              {page} / {meta.totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={page === meta.totalPages}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-xl text-sm disabled:opacity-40 transition-colors"
            >
              Sonraki
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
