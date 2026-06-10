"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Veri alınamadı");
    return r.json();
  });

export interface Product {
  id: string;
  asin: string;
  title: string | null;
  category: string | null;
  imageUrl: string | null;
  amazonPrice: number | null;
  amazonStockStatus: string;
  amazonStockQty: number | null;
  ebayFeeRate: number;
  targetMargin: number;
  floorPrice: number | null;
  calculatedEbayPrice: number | null;
  pollTier: string;
  lastScrapedAt: string | null;
  status: string;
  createdAt: string;
}

export function useProducts(params?: {
  status?: string;
  pollTier?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const query = new URLSearchParams();
  if (params?.status)   query.set("status",   params.status);
  if (params?.pollTier) query.set("pollTier", params.pollTier);
  if (params?.search)   query.set("search",   params.search);
  if (params?.page)     query.set("page",     String(params.page));
  if (params?.limit)    query.set("limit",    String(params.limit));

  const key = `/api/products?${query.toString()}`;
  const { data, error, isLoading } = useSWR<{
    data: Product[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>(key, fetcher);

  const [actionLoading, setActionLoading] = useState(false);

  const addProduct = async (asin: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ürün eklenemedi");
      }
      const product = await res.json();
      await mutate(key);
      return product as Product;
    } finally {
      setActionLoading(false);
    }
  };

  const scrapeProduct = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/products/${id}/scrape`, { method: "POST" });
      if (!res.ok) throw new Error("Güncelleme başarısız");
      await mutate(key);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteProduct = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silme başarısız");
      await mutate(key);
    } finally {
      setActionLoading(false);
    }
  };

  return {
    products: data?.data ?? [],
    total: data?.meta?.total ?? 0,
    page: data?.meta?.page ?? 1,
    isLoading,
    isError: !!error,
    actionLoading,
    addProduct,
    scrapeProduct,
    deleteProduct,
    refresh: () => mutate(key),
  };
}
