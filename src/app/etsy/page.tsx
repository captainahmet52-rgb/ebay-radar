"use client";

import {
  Package, MessageSquare, TrendingUp, BarChart2, HeartHandshake, Zap,
} from "lucide-react";
import { ComingSoonBot, type BotFeature } from "@/components/coming-soon-bot";

const FEATURES: BotFeature[] = [
  { icon: Package,        title: "Ürün Yayınlama",   desc: "Ürünlerinizi Etsy mağazanıza otomatik listeleyin." },
  { icon: MessageSquare,  title: "Mesaj Otomasyonu", desc: "Müşteri mesajlarına AI ile otomatik yanıt verin." },
  { icon: TrendingUp,     title: "Stok Yönetimi",    desc: "Stok değişimleri gerçek zamanlı senkronize edilir." },
  { icon: BarChart2,      title: "Mağaza Analitiği", desc: "Satış trendleri, dönüşüm oranı ve kâr analizi." },
  { icon: HeartHandshake, title: "Müşteri Destek AI",desc: "Yapay zeka destekli müşteri hizmetleri asistanı." },
  { icon: Zap,            title: "Hızlı Listeleme",  desc: "Tek tıkla çok sayıda ürün yayınlayın." },
];

export default function EtsyBotPage() {
  return (
    <ComingSoonBot
      botName="EtsyBot"
      accent="#f97316"
      description="Etsy mağazanı bağla; ürün listeleme, stok takibi, müşteri mesajları ve sipariş yönetimini tek yerden otomatikleştir."
      features={FEATURES}
      logo={
        <span className="text-[3rem] font-black leading-none tracking-tight" style={{ color: "#f97316", fontFamily: "Georgia, serif" }}>
          Etsy
        </span>
      }
    />
  );
}
