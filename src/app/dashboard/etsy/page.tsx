"use client";

import { motion } from "framer-motion";
import {
  Package, MessageSquare, BarChart2, Headphones,
  TrendingUp, Zap, Clock, ArrowRight, CheckCircle2,
} from "lucide-react";

const features = [
  { icon: Package,      title: "Ürün Yayınlama",       desc: "Ürünlerinizi Etsy mağazanıza otomatik listeleyin." },
  { icon: MessageSquare,title: "Mesaj Otomasyonu",      desc: "Müşteri mesajlarına AI ile otomatik yanıt verin." },
  { icon: TrendingUp,   title: "Stok Yönetimi",         desc: "Stok değişimleri gerçek zamanlı senkronize edilir." },
  { icon: BarChart2,    title: "Mağaza Analitiği",      desc: "Satış trendleri, dönüşüm oranı ve kâr analizi." },
  { icon: Headphones,   title: "Müşteri Destek AI",     desc: "Yapay zeka destekli müşteri hizmetleri asistanı." },
  { icon: Zap,          title: "Hızlı Listeleme",       desc: "Tek tıkla çok sayıda ürün yayınlayın." },
];

const steps = [
  { step: "1", title: "Etsy Mağazanı Bağla", desc: "Etsy satıcı hesabınızı OAuth ile güvenli şekilde bağlayın." },
  { step: "2", title: "Ürünleri Seç",         desc: "Depodan veya manuel olarak listelemek istediğiniz ürünleri seçin." },
  { step: "3", title: "Otomatik Sat",          desc: "Sistem fiyatları, stokları ve mesajları otomatik yönetir." },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function EtsyPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10 py-2">

      {/* Header */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4 }}
        className="relative rounded-3xl overflow-hidden p-8"
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(10,10,20,0.9) 100%)",
          border: "1px solid rgba(249,115,22,0.25)",
          boxShadow: "0 0 60px rgba(249,115,22,0.08)",
        }}
      >
        {/* Glow blob */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(249,115,22,0.4), transparent 70%)", filter: "blur(40px)" }}
        />
        <div className="relative flex items-start justify-between gap-6">
          <div className="space-y-3">
            {/* Yakında rozeti */}
            <div className="inline-flex items-center gap-2 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              ÇOK YAKINDA
            </div>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Etsy Satıcı Entegrasyonu
            </h1>
            <p className="text-slate-400 max-w-lg leading-relaxed">
              Etsy mağazanızı bağlayın. Ürün listeleme, stok takibi, müşteri mesajları ve
              sipariş yönetimini tek platformdan otomatik hale getirin.
            </p>
          </div>

          {/* Etsy logo */}
          <div
            className="flex-shrink-0 w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-orange-500 shadow-xl"
            style={{
              background: "linear-gradient(145deg, rgba(30,15,5,0.9), rgba(10,10,20,0.95))",
              border: "1px solid rgba(249,115,22,0.3)",
              boxShadow: "0 20px 40px rgba(249,115,22,0.2)",
              transform: "rotateX(-8deg) rotateY(-12deg)",
            }}
          >
            E
          </div>
        </div>

        {/* Connect button — disabled */}
        <div className="relative mt-6">
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold cursor-not-allowed opacity-50"
            style={{ background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff" }}
          >
            Etsy Mağazanı Bağla
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-slate-500 mt-2">Entegrasyon yakında aktif edilecek</p>
        </div>
      </motion.div>

      {/* Nasıl çalışır */}
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-6"
      >
        <h2 className="text-lg font-bold text-white mb-6">Nasıl Çalışır?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 * i + 0.2 }}
              className="flex gap-4"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg,#f97316,#ea580c)" }}
              >
                {s.step}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{s.title}</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Özellikler */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Özellikler</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i + 0.3 }}
              className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 hover:border-orange-500/20 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                <f.icon className="h-5 w-5 text-orange-400" />
              </div>
              <p className="text-white font-semibold text-sm mb-1">{f.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex items-start gap-3 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4"
      >
        <CheckCircle2 className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 text-sm leading-relaxed">
          Etsy entegrasyonu için ekibimiz aktif olarak geliştirme yapıyor.
          Hazır olduğunda otomatik olarak bilgilendirileceksiniz.
          eBay entegrasyonunu kullanmaya devam edebilirsiniz.
        </p>
      </motion.div>
    </div>
  );
}
