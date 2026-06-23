"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Copy, Check, Users, DollarSign, Percent, Mail } from "lucide-react";

interface AffiliateData {
  isAffiliate: boolean;
  link?: string;
  code?: string;
  referredCount?: number;
  commissionRatePct?: number;
  commissionBalanceUsd?: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<AffiliateData>;

export default function AffiliatePage() {
  const { data, isLoading } = useSWR<AffiliateData>("/api/affiliate", fetcher);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!data?.link) return;
    await navigator.clipboard.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Handshake className="h-6 w-6 text-violet-400" /> Ortaklık Programı
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Lean Automation&apos;ı tanıt, getirdiğin her ödeyen müşteriden komisyon kazan.
        </p>
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : !data?.isAffiliate ? (
        /* Affiliate değil → başvuru ekranı */
        <Card className="p-8 text-center">
          <Handshake className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-white font-semibold">Henüz ortak değilsin</p>
          <p className="text-sm text-slate-400 mt-1 mb-4 max-w-md mx-auto">
            YouTuber, içerik üreticisi veya topluluk sahibiysen ortaklık programına başvur.
            Getirdiğin her ödeyen müşteriden komisyon kazanırsın.
          </p>
          <a
            href="mailto:captainahmet52@gmail.com?subject=Ortaklık%20Başvurusu"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#3b82f6)" }}
          >
            <Mail className="h-4 w-4" /> Başvur
          </a>
        </Card>
      ) : (
        <>
          {/* İstatistikler */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Users className="h-4 w-4" /> Getirdiğin</div>
              <p className="text-3xl font-bold text-white mt-2">{data.referredCount ?? 0}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Percent className="h-4 w-4" /> Komisyon</div>
              <p className="text-3xl font-bold text-violet-400 mt-2">%{data.commissionRatePct ?? 0}</p>
            </Card>
            <Card className="p-5">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><DollarSign className="h-4 w-4" /> Bakiye</div>
              <p className="text-3xl font-bold text-emerald-400 mt-2">${(data.commissionBalanceUsd ?? 0).toFixed(2)}</p>
            </Card>
          </div>

          {/* Tanıtım linki */}
          <Card className="p-5 space-y-3">
            <p className="text-sm font-medium text-slate-300">Tanıtım Linkin</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={data.link ?? ""}
                onFocus={(e) => e.target.select()}
                className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none"
              />
              <Button onClick={copy} variant="secondary">
                {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Bu linkle kayıt olup paket satın alan her kullanıcıdan %{data.commissionRatePct ?? 0} komisyon kazanırsın.
              Bakiye birikince ödeme için bizimle iletişime geç.
            </p>
          </Card>
        </>
      )}
    </motion.div>
  );
}
