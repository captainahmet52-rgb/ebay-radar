"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Upload, Zap, Eye, Store } from "lucide-react";

interface BulkResult {
  requested: number;
  added: number;
  skippedDupe: number;
  skippedLimit: number;
  remaining: number;
  productLimit: number;
}

interface EbayAccountMeta {
  id: string;
  ebayUserId: string;
  marketplace: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** EBAY_US → "US", EBAY_GB → "UK" gibi kısa pazar etiketi. */
function marketLabel(marketplace: string): string {
  const map: Record<string, string> = {
    EBAY_US: "🇺🇸 US",
    EBAY_GB: "🇬🇧 UK",
    EBAY_DE: "🇩🇪 DE",
    EBAY_AU: "🇦🇺 AU",
  };
  return map[marketplace] ?? marketplace.replace("EBAY_", "");
}

export function BulkUploadModal({ open, onClose, onSuccess }: BulkUploadModalProps) {
  const [input, setInput] = useState("");
  const [marginPct, setMarginPct] = useState(30);
  const [stockQty, setStockQty] = useState(1);
  const [intervalSec, setIntervalSec] = useState(1);
  const [mode, setMode] = useState<"auto" | "draft">("auto");
  const [ebayAccountId, setEbayAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BulkResult | null>(null);

  const { data: accountsRes } = useSWR(open ? "/api/ebay/accounts" : null, fetcher);
  const accounts: EbayAccountMeta[] = accountsRes?.data ?? [];

  // İlk mağazayı varsayılan seç (kullanıcı değiştirmediyse)
  useEffect(() => {
    if (accounts.length > 0 && !ebayAccountId) {
      setEbayAccountId(accounts[0].id);
    }
  }, [accounts, ebayAccountId]);

  async function start() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, profitMarginPct: marginPct, stockQty, intervalSec, mode, ebayAccountId: ebayAccountId || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Yükleme başarısız");
      setResult(j);
      onSuccess?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setInput(""); setResult(null); setError("");
    onClose();
  }

  const fieldCls = "w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50";

  return (
    <Modal open={open} onClose={close} title="Toplu ASIN/URL Yükle">
      <div className="space-y-4">
        {result ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle className="h-5 w-5" /> Yükleme tamamlandı
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-800/60 rounded-lg p-3"><p className="text-slate-400 text-xs">Eklendi</p><p className="text-emerald-400 font-bold text-lg">{result.added}</p></div>
              <div className="bg-slate-800/60 rounded-lg p-3"><p className="text-slate-400 text-xs">Kalan limit</p><p className="text-white font-bold text-lg">{result.remaining}/{result.productLimit}</p></div>
              <div className="bg-slate-800/60 rounded-lg p-3"><p className="text-slate-400 text-xs">Zaten ekli (atlandı)</p><p className="text-slate-300 font-bold">{result.skippedDupe}</p></div>
              <div className="bg-slate-800/60 rounded-lg p-3"><p className="text-slate-400 text-xs">Limit aşımı (atlandı)</p><p className="text-amber-400 font-bold">{result.skippedLimit}</p></div>
            </div>
            <Button onClick={close} className="w-full">Kapat</Button>
          </motion.div>
        ) : (
          <>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-1.5">
                ASIN veya Amazon URL&apos;leri <span className="text-slate-500">(Her satırda bir adet)</span>
              </label>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                placeholder={"B08N5WRWNW\nhttps://www.amazon.com/dp/B08N5WRWNW\nB07XYZ123A"}
                className={`${fieldCls} resize-y font-mono text-xs`}
              />
              <p className="text-xs text-slate-500 mt-1">ASIN kodları veya Amazon ürün URL&apos;lerini her satıra bir tane gelecek şekilde girin</p>
            </div>

            {/* Hedef mağaza — birden fazla eBay mağazası bağlıysa seçim zorunlu */}
            {accounts.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> Önce Ayarlar&apos;dan bir eBay mağazası bağla.
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Hedef Mağaza
                  {accounts.length > 1 && <span className="text-violet-400">({accounts.length} mağaza)</span>}
                </label>
                <select
                  value={ebayAccountId}
                  onChange={(e) => setEbayAccountId(e.target.value)}
                  className={fieldCls}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id} className="bg-slate-800">
                      {a.ebayUserId} — {marketLabel(a.marketplace)}
                    </option>
                  ))}
                </select>
                {accounts.length > 1 && (
                  <p className="text-xs text-slate-500 mt-1">Ürünler seçtiğin mağazaya yüklenir; her mağaza kendi pazarına göre fiyatlanır.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Kâr Marjı (%)</label>
                <input type="number" value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">Stok Adedi</label>
                <input type="number" value={stockQty} onChange={(e) => setStockQty(Number(e.target.value))} className={fieldCls} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1.5">İşlem Aralığı (sn)</label>
                <input type="number" value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} className={fieldCls} />
              </div>
            </div>

            {/* Yükleme modu */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">Yükleme Modu</p>
              {([
                { v: "auto", icon: Zap, title: "Tam Otomatik eBay'e Yükle", desc: "Ürünler Amazon'dan çekilir ve doğrudan eBay'e yüklenir." },
                { v: "draft", icon: Eye, title: "Önce Taslaklara Kaydet (Manuel Kontrol)", desc: "Ürünler önce Taslaklar'a kaydedilir, manuel düzenleyip onaylarsın." },
              ] as const).map((o) => (
                <button key={o.v} onClick={() => setMode(o.v)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-colors ${mode === o.v ? "border-violet-500/50 bg-violet-500/10" : "border-slate-700/50 hover:bg-white/5"}`}>
                  <o.icon className={`h-4 w-4 mt-0.5 ${mode === o.v ? "text-violet-400" : "text-slate-400"}`} />
                  <div>
                    <p className={`text-sm font-medium ${mode === o.v ? "text-violet-300" : "text-white"}`}>{o.title}</p>
                    <p className="text-xs text-slate-400">{o.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
              </div>
            )}

            <Button onClick={start} loading={loading} disabled={!input.trim() || !ebayAccountId} className="w-full">
              <Upload className="h-4 w-4" /> Yüklemeyi Başlat
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
