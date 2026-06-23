"use client";

import { motion } from "framer-motion";
import useSWR from "swr";
import { Pause, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ListingStatus } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Listing {
  id: string;
  ebayListingId: string;
  currentPrice: number;
  currentQty: number;
  status: ListingStatus;
  publishStage?: string | null;
  lastEbayError?: string | null;
  product: {
    asin: string;
    title: string;
  };
  ebayAccount: {
    ebayUserId: string;
  };
}

/** Yayın durumu rozeti: yüklendi ✓ / yükleniyor… / yüklenmedi (sebep). */
function PublishStatus({ listing }: { listing: Listing }) {
  if (listing.ebayListingId) {
    return <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400">Yüklendi ✓</span>;
  }
  if (listing.lastEbayError) {
    return (
      <span
        className="text-xs px-2 py-1 rounded-full bg-red-500/15 text-red-400 cursor-help"
        title={listing.lastEbayError}
      >
        Yüklenmedi
      </span>
    );
  }
  const inProgress = ["pending_publish", "inventory_done", "offer_created"].includes(
    listing.publishStage ?? ""
  );
  if (inProgress) {
    return <span className="text-xs px-2 py-1 rounded-full bg-blue-500/15 text-blue-400">Yükleniyor…</span>;
  }
  return <span className="text-xs text-slate-500">—</span>;
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="shimmer h-4 rounded w-full" />
        </td>
      ))}
    </tr>
  );
}

export default function ListingsPage() {
  const { data, isLoading, mutate } = useSWR("/api/listings", fetcher);
  const listings: Listing[] = data?.data ?? [];

  const handlePause = async (id: string) => {
    await fetch(`/api/listings/${id}/pause`, { method: "PUT" });
    mutate();
  };

  const handleResume = async (id: string) => {
    await fetch(`/api/listings/${id}/resume`, { method: "PUT" });
    mutate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu listeyi silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/listings/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">eBay Listeler</h1>
        <p className="text-sm text-slate-400 mt-1">
          {listings.length} aktif liste
        </p>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50 bg-slate-900/60">
                {["Ürün", "eBay Fiyatı", "Adet", "Yayın", "Durum", "eBay Mağaza", "eBay ID", "Eylemler"].map(
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
                : listings.length === 0
                ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                      Henüz liste yok. Ürünler sayfasından ürün ekleyin.
                    </td>
                  </tr>
                )
                : listings.map((listing, index) => (
                  <motion.tr
                    key={listing.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-violet-400">{listing.product?.asin}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px] truncate">
                        {listing.product?.title}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-white font-mono font-semibold text-xs">
                      ${listing.currentPrice?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {listing.currentQty} adet
                    </td>
                    <td className="px-4 py-3">
                      <PublishStatus listing={listing} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={listing.status === "active" ? "active" : listing.status === "paused" ? "paused" : "out"} />
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {listing.ebayAccount?.ebayUserId}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-500">{listing.ebayListingId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {listing.status === "active" ? (
                          <button
                            onClick={() => handlePause(listing.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
                            title="Duraklat"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResume(listing.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            title="Devam Ettir"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(listing.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
