"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { Plus, Search, Layers } from "lucide-react";
import { ProductTable } from "@/components/products/product-table";
import { AddProductModal } from "@/components/products/add-product-modal";
import { BulkUploadModal } from "@/components/products/bulk-upload-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ListingStatus } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FILTER_TABS = [
  { label: "Hepsi",         value: "all"     },
  { label: "Aktif",         value: "active"  },
  { label: "Duraklatıldı",  value: "paused"  },
  { label: "Sıcak",         value: "hot"     },
] as const;

type FilterValue = (typeof FILTER_TABS)[number]["value"];

export default function ProductsPage() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading, mutate } = useSWR("/api/products", fetcher);
  const products = data?.data ?? data ?? [];

  // Client-side filter
  const filtered = products.filter((p: { status: ListingStatus; pollTier: string; asin: string; title: string }) => {
    const matchesFilter =
      filter === "all"    ? true :
      filter === "active" ? p.status === "active" :
      filter === "paused" ? p.status === "paused" :
      filter === "hot"    ? p.pollTier === "hot"   :
      true;

    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      p.asin.toLowerCase().includes(q) ||
      p.title?.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const handleRefresh = async (id: string) => {
    await fetch(`/api/products/${id}/scrape`, { method: "POST" });
    mutate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ürünler</h1>
          <p className="text-sm text-slate-400 mt-1">
            {products.length} ürün takip ediliyor
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4" />
            Toplu ASIN
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Ürün Ekle
          </Button>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900/60 border border-slate-700/50 rounded-xl p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                filter === tab.value
                  ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="ASIN veya başlık ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden">
        <ProductTable
          products={filtered}
          loading={isLoading}
          onRefresh={handleRefresh}
          onDelete={handleDelete}
          onAddProduct={() => setModalOpen(true)}
        />
      </div>

      {/* Add Product Modal */}
      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => mutate()}
      />

      {/* Toplu ASIN/URL Yükle */}
      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => mutate()}
      />
    </motion.div>
  );
}
