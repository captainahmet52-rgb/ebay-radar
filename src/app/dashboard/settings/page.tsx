"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { Plus, Trash2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface EbayAccount {
  id: string;
  ebayUserId: string;
  marketplace?: string;
  tokenExpiresAt: string;
}

const EBAY_MARKET_LABELS: Record<string, string> = {
  EBAY_US: "🇺🇸 eBay US",
  EBAY_GB: "🇬🇧 eBay UK",
  EBAY_DE: "🇩🇪 eBay DE",
  EBAY_AU: "🇦🇺 eBay AU",
};

const fadeUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

export default function SettingsPage() {
  const { data: accountsRes, mutate } = useSWR("/api/ebay/accounts", fetcher);
  const accounts: EbayAccount[] = accountsRes?.data ?? [];
  const [connectingEbay, setConnectingEbay] = useState(false);

  const handleEbayConnect = async () => {
    setConnectingEbay(true);
    try {
      const res = await fetch("/api/ebay/connect");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert("eBay bağlantısı başlatılamadı.");
    } finally {
      setConnectingEbay(false);
    }
  };

  const handleEbayDisconnect = async (id: string) => {
    if (!confirm("Bu hesabı kaldırmak istediğinize emin misiniz?")) return;
    await fetch(`/api/ebay/accounts/${id}`, { method: "DELETE" });
    mutate();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-3xl mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Ayarlar</h1>
        <p className="text-sm text-slate-400 mt-1">Hesap ve otomasyon ayarlarınızı yönetin</p>
      </div>

      {/* Section 1: eBay Accounts */}
      <motion.section variants={fadeUp} initial="initial" animate="animate" transition={{ delay: 0.1 }}>
        <Card>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">eBay Hesapları</h2>
              <p className="text-sm text-slate-400 mt-1">Mağazalarınızı bağlayın ve yönetin</p>
            </div>
            <Button onClick={handleEbayConnect} loading={connectingEbay} size="sm">
              <Plus className="h-4 w-4" />
              Hesap Bağla
            </Button>
          </div>

          <div className="space-y-3">
            {!accounts || accounts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">Bağlı eBay hesabı yok.</p>
                <button
                  onClick={handleEbayConnect}
                  className="mt-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Hemen bağla →
                </button>
              </div>
            ) : (
              accounts.map((account, i) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700/30 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {account.ebayUserId}
                        {account.marketplace && (
                          <span className="ml-2 text-xs font-normal text-violet-300">
                            {EBAY_MARKET_LABELS[account.marketplace] ?? account.marketplace}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        Token: {new Date(account.tokenExpiresAt) > new Date() ? "Geçerli" : "Süresi Doldu"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="verified" />
                    <button
                      onClick={() => handleEbayDisconnect(account.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </motion.section>
    </motion.div>
  );
}
