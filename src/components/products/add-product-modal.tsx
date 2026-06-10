"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, AlertCircle } from "lucide-react";

interface EbayAccount {
  id: string;
  ebayUserId: string;
}

interface ProductResult {
  id: string;
  asin: string;
  title: string;
  amazonPrice: number;
  ebayPrice: number;
  netProfit: number;
  marginPct: number;
  stockStatus: string;
}

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  ebayAccounts?: EbayAccount[];
  onSuccess?: () => void;
}

export function AddProductModal({ open, onClose, ebayAccounts = [], onSuccess }: AddProductModalProps) {
  const [asin, setAsin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductResult | null>(null);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [listing, setListing] = useState(false);
  const [listingSuccess, setListingSuccess] = useState(false);

  const handleQuery = async () => {
    if (!asin.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: asin.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Ürün bulunamadı");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const handleList = async () => {
    if (!result || !selectedAccount) return;
    setListing(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: result.id, ebayAccountId: selectedAccount }),
      });
      if (!res.ok) throw new Error("Listeleme başarısız");
      setListingSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        resetState();
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Listeleme hatası");
    } finally {
      setListing(false);
    }
  };

  const resetState = () => {
    setAsin("");
    setResult(null);
    setError("");
    setSelectedAccount("");
    setListingSuccess(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Yeni Ürün Ekle">
      <div className="space-y-4">
        {/* ASIN Input */}
        <div className="flex gap-2">
          <Input
            label="Amazon ASIN"
            placeholder="B09G9HD6PD"
            value={asin}
            onChange={(e) => setAsin(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleQuery()}
            icon={<Search className="h-4 w-4" />}
            className="flex-1"
          />
        </div>
        <Button
          onClick={handleQuery}
          loading={loading}
          disabled={!asin.trim()}
          className="w-full"
        >
          <Search className="h-4 w-4" />
          Sorgula
        </Button>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4"
            >
              {/* Product info */}
              <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Ürün</p>
                  <p className="text-sm font-medium text-white mt-0.5 leading-snug">{result.title}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400">Amazon</p>
                    <p className="text-sm font-bold text-white mt-0.5">${result.amazonPrice.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400">eBay Fiyatı</p>
                    <p className="text-sm font-bold text-violet-400 mt-0.5">${result.ebayPrice.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-slate-400">Net Kâr</p>
                    <p className="text-sm font-bold text-emerald-400 mt-0.5">%{result.marginPct.toFixed(1)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Stok durumu:</span>
                  <Badge
                    variant={
                      result.stockStatus === "in_stock"
                        ? "active"
                        : result.stockStatus === "low"
                        ? "paused"
                        : "out"
                    }
                  />
                </div>
              </div>

              {/* Account select */}
              {ebayAccounts.length > 0 ? (
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-1.5">
                    eBay Mağazası Seç
                  </label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="" disabled>Mağaza seçin...</option>
                    {ebayAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.ebayUserId}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                  eBay hesabı bağlı değil. Ayarlar sayfasından hesabınızı bağlayın.
                </div>
              )}

              {listingSuccess ? (
                <div className="text-center py-3 text-emerald-400 font-medium text-sm">
                  Ürün başarıyla listelendi!
                </div>
              ) : (
                <Button
                  onClick={handleList}
                  loading={listing}
                  disabled={!selectedAccount || ebayAccounts.length === 0}
                  className="w-full"
                >
                  <ShoppingCart className="h-4 w-4" />
                  eBay&apos;de Listele
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
