"use client";

import { motion } from "framer-motion";
import {
  Package, TrendingUp, ShoppingCart, BarChart2,
  Star, RefreshCcw, Clock, ArrowRight, CheckCircle2,
} from "lucide-react";

const features = [
  { icon: Package,      title: "Stok Senkronizasyonu",  desc: "Amazon depo stoğunuz otomatik senkronize edilir." },
  { icon: ShoppingCart, title: "Sipariş Otomasyonu",    desc: "Gelen siparişler otomatik işlenir ve yönetilir." },
  { icon: TrendingUp,   title: "AI Ürün Yönetimi",     desc: "Yapay zeka ile en kârlı ürünler otomatik belirlenir." },
  { icon: Star,         title: "Buy Box Takibi",        desc: "Buy Box kazanma oranınız gerçek zamanlı izlenir." },
  { icon: BarChart2,    title: "Kâr Analitiği",         desc: "Detaylı kâr/zarar raporları ve trend analizleri." },
  { icon: RefreshCcw,   title: "Otomatik Yeniden Fiyatlama", desc: "Rakiplere göre fiyatlarınız otomatik güncellenir." },
];

const steps = [
  { step: "1", title: "Hesap Bağla",     desc: "Amazon Seller Central hesabınızı OAuth ile bağlayın." },
  { step: "2", title: "Ürün Seç",        desc: "Listeletmek istediğiniz ürünleri seçin veya filtreleyin." },
  { step: "3", title: "Otomasyonu Başlat", desc: "Sistem devreye girer, siz sadece kârı takip edersiniz." },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function AmazonPage() {
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
          background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(10,10,20,0.9) 100%)",
          border: "1px solid rgba(245,158,11,0.25)",
          boxShadow: "0 0 60px rgba(245,158,11,0.08)",
        }}
      >
        {/* Glow blob */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.4), transparent 70%)", filter: "blur(40px)" }}
        />
        <div className="relative flex items-start justify-between gap-6">
          <div className="space-y-3">
            {/* Yakında rozeti */}
            <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              ÇOK YAKINDA
            </div>
            <h1 className="text-3xl font-extrabold text-white leading-tight">
              Amazon Satıcı Entegrasyonu
            </h1>
            <p className="text-slate-400 max-w-lg leading-relaxed">
              Amazon Seller Central hesabınızı bağlayın. Ürünleriniz, stoklarınız ve siparişleriniz
              otomatik olarak yönetilsin. Kârlı ürünleri AI ile keşfedip tek tıkla listeleyin.
            </p>
          </div>

          {/* Amazon logo */}
          <div
            className="flex-shrink-0 w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-amber-400 shadow-xl"
            style={{
              background: "linear-gradient(145deg, rgba(30,25,10,0.9), rgba(10,10,20,0.95))",
              border: "1px solid rgba(245,158,11,0.3)",
              boxShadow: "0 20px 40px rgba(245,158,11,0.2)",
              transform: "rotateX(-8deg) rotateY(-12deg)",
            }}
          >
            a
          </div>
        </div>

        {/* Connect button — disabled */}
        <div className="relative mt-6">
          <button
            disabled
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold cursor-not-allowed opacity-50"
            style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}
          >
            Amazon Hesabını Bağla
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-black flex-shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}
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
              className="rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5 hover:border-amber-500/20 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.2)" }}
              >
                <f.icon className="h-5 w-5 text-amber-400" />
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
        className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4"
      >
        <CheckCircle2 className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 text-sm leading-relaxed">
          Amazon entegrasyonu için ekibimiz aktif olarak geliştirme yapıyor.
          Hazır olduğunda otomatik olarak bilgilendirileceksiniz.
          eBay entegrasyonunu kullanmaya devam edebilirsiniz.
        </p>
      </motion.div>
    </div>
  );
}
