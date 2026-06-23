"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check, Users, CalendarPlus, Share2 } from "lucide-react";

interface ReferralData {
  code: string;
  link: string;
  referralCount: number;
  rewardDays: number;
  rewardPerInvite: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<ReferralData>;

export default function ReferralPage() {
  const { data } = useSWR<ReferralData>("/api/referral", fetcher);
  const [copied, setCopied] = useState(false);

  const link = data?.link ?? "";
  const reward = data?.rewardPerInvite ?? 7;

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!link) return;
    const text = `Lean Automation ile eBay mağazanı otomatikleştir! Bu linkle kayıt ol, ikimiz de ${reward} gün bedava kazanalım: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Lean Automation", text, url: link }); } catch { /* iptal */ }
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          <Gift className="h-6 w-6 text-violet-400" /> Arkadaşını Davet Et
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Davet linkinle kayıt olan her kişi için <span className="text-emerald-400 font-semibold">ikiniz de {reward} gün bedava</span> kazanırsınız.
        </p>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Users className="h-4 w-4" /> Davet Ettiğin
          </div>
          <p className="text-3xl font-bold text-white mt-2">{data?.referralCount ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">kişi kayıt oldu</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <CalendarPlus className="h-4 w-4" /> Bonus Bakiye
          </div>
          <p className="text-3xl font-bold text-emerald-400 mt-2">{data?.rewardDays ?? 0}</p>
          <p className="text-xs text-slate-500 mt-1">gün — sonraki mağaza denemende kullanılır</p>
        </Card>
      </div>

      {/* Davet linki */}
      <Card className="p-5 space-y-3">
        <p className="text-sm font-medium text-slate-300">Davet Linkin</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none"
            onFocus={(e) => e.target.select()}
          />
          <Button onClick={copy} variant="secondary">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
        </div>
        <Button onClick={share} className="w-full">
          <Share2 className="h-4 w-4" /> Paylaş
        </Button>
        {data?.code && (
          <p className="text-xs text-slate-500 text-center">
            Davet kodun: <span className="font-mono text-slate-300">{data.code}</span>
          </p>
        )}
      </Card>

      {/* Nasıl çalışır */}
      <Card className="p-5">
        <p className="text-sm font-medium text-white mb-3">Nasıl çalışır?</p>
        <ol className="space-y-2 text-sm text-slate-400">
          <li className="flex gap-2"><span className="text-violet-400 font-bold">1.</span> Linkini arkadaşınla paylaş.</li>
          <li className="flex gap-2"><span className="text-violet-400 font-bold">2.</span> Arkadaşın bu linkle kayıt olur — başlangıçta +{reward} gün bonus alır.</li>
          <li className="flex gap-2"><span className="text-violet-400 font-bold">3.</span> Sen de +{reward} gün kazanırsın; bonus, yeni mağaza bağladığında denemene eklenir.</li>
        </ol>
      </Card>
    </motion.div>
  );
}
