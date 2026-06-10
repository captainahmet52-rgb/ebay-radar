"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Zap,
  Target,
  Check,
  ArrowRight,
  Bot,
  DollarSign,
  Package,
  Shield,
} from "lucide-react";

// Animation helpers
const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.12 } },
};

function AnimatedSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="initial"
      animate={inView ? "animate" : "initial"}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Mock dashboard preview
function DashboardPreview() {
  return (
    <div className="relative w-full max-w-lg mx-auto animate-float">
      {/* Outer glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-blue-600/10 rounded-3xl blur-2xl" />
      {/* Main card */}
      <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <div className="flex-1 h-6 bg-slate-800/60 rounded-lg flex items-center px-3">
            <span className="text-[10px] text-slate-500">dashboard • eBayBot</span>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: "Toplam Kâr", value: "$12,480", color: "text-violet-400" },
            { label: "Aktif Liste", value: "247",    color: "text-blue-400"   },
            { label: "Bu Ay",      value: "$3,920",  color: "text-emerald-400"},
          ].map((s) => (
            <div key={s.label} className="bg-slate-800/60 rounded-xl p-2.5">
              <p className="text-[9px] text-slate-500">{s.label}</p>
              <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        {/* Chart mock */}
        <div className="bg-slate-800/60 rounded-xl p-3 mb-3 h-20 relative overflow-hidden">
          <p className="text-[9px] text-slate-500 mb-1">Kâr Grafiği</p>
          <svg viewBox="0 0 200 40" className="w-full h-10">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,35 C20,30 40,20 60,18 C80,16 100,25 120,15 C140,5 160,12 180,8 L180,40 L0,40 Z"
              fill="url(#lg)"
            />
            <path
              d="M0,35 C20,30 40,20 60,18 C80,16 100,25 120,15 C140,5 160,12 180,8"
              fill="none"
              stroke="#7c3aed"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        {/* Product rows */}
        <div className="space-y-1.5">
          {[
            { asin: "B09G9HD6PD", price: "$145.20", profit: "+$29.04", badge: "bg-emerald-500/20 text-emerald-400" },
            { asin: "B08N5WRWNW", price:  "$89.99", profit: "+$18.00", badge: "bg-blue-500/20 text-blue-400"       },
            { asin: "B07XJ8C8F5", price: "$212.50", profit: "+$42.50", badge: "bg-amber-500/20 text-amber-400"     },
          ].map((p) => (
            <div key={p.asin} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-1.5">
              <span className="text-[10px] font-mono text-violet-400">{p.asin}</span>
              <span className="text-[10px] text-white">{p.price}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.badge}`}>{p.profit}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const stats = [
  { value: "10.000+", label: "Aktif Ürün" },
  { value: "%20",     label: "Net Kâr Marjı" },
  { value: "7/24",    label: "Otomasyon" },
];

const features = [
  {
    icon: <Target className="h-6 w-6" />,
    title: "Akıllı Radar",
    desc: "Kârlı ürünleri otomatik tespit eder, rakip analizi yapar ve size en iyi fırsatları sunar.",
    color: "from-violet-600 to-violet-400",
  },
  {
    icon: <DollarSign className="h-6 w-6" />,
    title: "Repricer Motoru",
    desc: "%20 net kâr garantili formül. Amazon fiyatı değişince eBay fiyatı saniyeler içinde güncellenir.",
    color: "from-blue-600 to-blue-400",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "7/24 Otomasyon",
    desc: "Stok ve fiyat değişimleri otomatik izlenir. Siz uyurken sistem çalışmaya devam eder.",
    color: "from-emerald-600 to-emerald-400",
  },
];

const plans = [
  {
    name: "Ücretsiz",
    price: "0",
    period: "/ay",
    description: "Başlangıç için ideal",
    features: ["10 ürün", "Manuel tarama", "Temel repricer", "E-posta destek"],
    cta: "Hemen Başla",
    href: "/register",
    highlight: false,
  },
  {
    name: "Pro",
    price: "29",
    period: "/ay",
    description: "Büyüyen işletmeler için",
    features: ["200 ürün", "15 dk otomatik tarama", "Gelişmiş repricer", "Sipariş doğrulama", "Öncelikli destek"],
    cta: "Pro'ya Geç",
    href: "/register",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "99",
    period: "/ay",
    description: "Büyük operasyonlar için",
    features: ["Sınırsız ürün", "10 dk tarama", "Çoklu mağaza", "API erişimi", "Özel destek"],
    cta: "İletişime Geç",
    href: "/register",
    highlight: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">eBayBot</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">Giriş Yap</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Ücretsiz Başla</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-20 pb-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="space-y-8"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                Yeni — Sipariş-anı doğrulama aktif
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl md:text-6xl font-extrabold leading-tight"
            >
              Amazon&apos;dan eBay&apos;e{" "}
              <span className="gradient-text">Otomatik Para Kazan</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-xl text-slate-400 leading-relaxed max-w-lg">
              Ürünleri otomatik bul, fiyatlandır ve listele. Kârı sen topla.
              <strong className="text-white"> %20 net kâr</strong> garantili repricer motoru.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-wrap gap-4">
              <Link href="/register">
                <Button size="lg" className="shadow-lg shadow-violet-500/30">
                  Ücretsiz Başla
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="lg">
                Demo İzle
              </Button>
            </motion.div>

            <motion.div variants={fadeUp} className="flex items-center gap-4 text-sm text-slate-400">
              <div className="flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-emerald-400" />
                <span>Kredi kartı gerektirmez</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-violet-400" />
                <span>2 dakikada kur</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right — dashboard preview */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <AnimatedSection className="relative z-10 px-6 md:px-12 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp}
              transition={{ delay: i * 0.1 }}
              className="text-center bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl py-6 px-4"
            >
              <p className="text-3xl font-extrabold gradient-text">{s.value}</p>
              <p className="text-sm text-slate-400 mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </AnimatedSection>

      {/* Features */}
      <AnimatedSection className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-7xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Neden <span className="gradient-text">eBayBot</span>?
            </h2>
            <p className="text-slate-400 mt-4 max-w-lg mx-auto">
              Rakipleriniz hâlâ manuel çalışırken siz otomatik kazanın.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600/50 transition-all duration-300"
              >
                <div
                  className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}
                >
                  <div className="text-white">{f.icon}</div>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* How it works */}
      <AnimatedSection className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Nasıl Çalışır?
            </h2>
          </motion.div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { step: "1", icon: <Package className="h-5 w-5" />, title: "ASIN Gir",     desc: "Amazon ürün kodunu sisteme gir" },
              { step: "2", icon: <Target className="h-5 w-5" />,  title: "Fiyat Hesapla", desc: "%20 kârlı eBay fiyatı otomatik çıkar" },
              { step: "3", icon: <Bot className="h-5 w-5" />,     title: "Listele",       desc: "eBay mağazana tek tıkla listele"  },
              { step: "4", icon: <DollarSign className="h-5 w-5" />, title: "Kazan",     desc: "Sistem otomatik çalışır, sen kazanırsın" },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 border border-violet-500/20 flex items-center justify-center mx-auto mb-3">
                  <div className="text-violet-400">{s.icon}</div>
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 text-white text-xs font-bold flex items-center justify-center mx-auto -mt-6 mb-3 relative">
                  {s.step}
                </div>
                <h4 className="font-semibold text-white mb-1">{s.title}</h4>
                <p className="text-xs text-slate-400">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Pricing */}
      <AnimatedSection className="relative z-10 px-6 md:px-12 pb-24">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-white">Fiyatlandırma</h2>
            <p className="text-slate-400 mt-4">Büyüdükçe planınızı yükseltin.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className={`relative rounded-2xl p-6 border transition-all duration-300 ${
                  plan.highlight
                    ? "bg-gradient-to-b from-violet-900/40 to-slate-900/60 border-violet-500/30 shadow-xl shadow-violet-500/10"
                    : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold">
                    En Popüler
                  </div>
                )}
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-400">{plan.name}</p>
                  <p className="text-3xl font-extrabold text-white mt-1">
                    ${plan.price}
                    <span className="text-base text-slate-400 font-normal">{plan.period}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{plan.description}</p>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href}>
                  <Button
                    variant={plan.highlight ? "primary" : "ghost"}
                    className="w-full justify-center"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* CTA banner */}
      <AnimatedSection className="relative z-10 px-6 md:px-12 pb-24">
        <motion.div
          variants={fadeUp}
          className="max-w-3xl mx-auto text-center bg-gradient-to-br from-violet-600/20 to-blue-600/10 border border-violet-500/20 rounded-3xl p-12"
        >
          <h2 className="text-3xl font-bold text-white mb-4">
            Hemen başlamaya hazır mısın?
          </h2>
          <p className="text-slate-400 mb-8">
            Ücretsiz hesap oluştur, 10 ürünle dene. Kredi kartı gerektirmez.
          </p>
          <Link href="/register">
            <Button size="lg" className="shadow-lg shadow-violet-500/30 mx-auto">
              Ücretsiz Hesap Oluştur
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </AnimatedSection>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-300">eBayBot</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2026 eBayBot. Tüm hakları saklıdır.
          </p>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Gizlilik</a>
            <a href="#" className="hover:text-white transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-white transition-colors">İletişim</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
