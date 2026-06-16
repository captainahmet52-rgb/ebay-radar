"use client";

import {
  RefreshCcw, ShoppingCart, Cpu, Target, BarChart2, RotateCcw,
} from "lucide-react";
import { ComingSoonBot, type BotFeature } from "@/components/coming-soon-bot";

const FEATURES: BotFeature[] = [
  { icon: RefreshCcw,  title: "Stok Senkronizasyonu",       desc: "Amazon depo stoğunuz otomatik senkronize edilir." },
  { icon: ShoppingCart,title: "Sipariş Otomasyonu",         desc: "Gelen siparişler otomatik işlenir ve yönetilir." },
  { icon: Cpu,         title: "AI Ürün Yönetimi",           desc: "Yapay zeka ile en kârlı ürünler otomatik belirlenir." },
  { icon: Target,      title: "Buy Box Takibi",             desc: "Buy Box kazanma oranınız gerçek zamanlı izlenir." },
  { icon: BarChart2,   title: "Kâr Analitiği",              desc: "Detaylı kâr/zarar raporları ve trend analizleri." },
  { icon: RotateCcw,   title: "Otomatik Yeniden Fiyatlama", desc: "Rakiplere göre fiyatlarınız otomatik güncellenir." },
];

export default function AmazonBotPage() {
  return (
    <ComingSoonBot
      botName="AmazonBot"
      accent="#f59e0b"
      description="Amazon mağazanı bağla; ürünleri, stokları ve siparişleri otomatik yönet. Kârlı ürünleri AI ile keşfet, tek tıkla listele."
      features={FEATURES}
      logo={
        <div className="inline-block">
          <span className="text-[3rem] font-black text-white leading-none tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            amazon
          </span>
          <svg width="160" height="22" viewBox="0 0 160 22" fill="none" className="mt-1.5 mx-auto block">
            <path d="M10 8 C 56 25, 110 25, 148 9" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <path d="M148 9 L138 7 M148 9 L142 16" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      }
    />
  );
}
