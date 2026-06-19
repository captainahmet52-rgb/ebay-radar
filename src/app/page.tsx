"use client";

import { useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import Link from "next/link";
import {
  RefreshCcw, ShoppingCart, Cpu, Target, BarChart2,
  Upload, DollarSign, RotateCcw, FileBarChart,
  Package, MessageSquare, TrendingUp, HeartHandshake,
  Shield, Lock, Server, Headphones, Star, ArrowRight, ChevronDown,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { FAQ } from "@/lib/faq";
import { FaqStructuredData } from "@/components/structured-data";

// ─── Feature ikonları ─────────────────────────────────────────────────────────

const AMAZON_FEATURES = [
  { icon: RefreshCcw,  label: "Stok Senkronizasyonu"  },
  { icon: ShoppingCart,label: "Sipariş Otomasyonu"    },
  { icon: Cpu,         label: "AI Ürün Yönetimi"      },
  { icon: Target,      label: "Buy Box Takibi"         },
  { icon: BarChart2,   label: "Kâr Analitiği"          },
];

const EBAY_FEATURES = [
  { icon: Upload,       label: "Otomatik Listeleme"   },
  { icon: DollarSign,   label: "Akıllı Fiyatlandırma" },
  { icon: ShoppingCart, label: "Sipariş Takibi"       },
  { icon: RotateCcw,    label: "İade Yönetimi"        },
  { icon: FileBarChart, label: "Performans Raporları" },
];

const ETSY_FEATURES = [
  { icon: Package,        label: "Ürün Yayınlama"    },
  { icon: MessageSquare,  label: "Mesaj Otomasyonu"  },
  { icon: TrendingUp,     label: "Stok Yönetimi"     },
  { icon: BarChart2,      label: "Mağaza Analitiği"  },
  { icon: HeartHandshake, label: "Müşteri Destek AI" },
];

const STATS = [
  { icon: Shield,     title: "%99.9 Uptime",     sub: "Kurumsal Güvenilirlik"   },
  { icon: Lock,       title: "Güvenli API",       sub: "Banka Düzeyinde Güvenlik" },
  { icon: Server,     title: "Kurumsal Altyapı",  sub: "Ölçeklenebilir & Güvenilir" },
  { icon: Headphones, title: "7/24 Destek",       sub: "Gerçek İnsanlar, Hızlı Çözüm" },
];

// ─── Feature satırı ───────────────────────────────────────────────────────────

function FeatureRow({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ border: `1px solid ${color}40`, background: `${color}15` }}
      >
        <Icon style={{ color }} className="h-3.5 w-3.5" />
      </span>
      <span className="text-slate-300 text-sm">{label}</span>
    </li>
  );
}

// ─── Platform kartı ───────────────────────────────────────────────────────────

interface CardProps {
  logo: React.ReactNode;
  tagline: string;
  badge?: boolean;
  features: { icon: React.ElementType; label: string }[];
  accent: string;        // ana marka rengi (hex)
  accent2: string;       // koyu ton (buton degrade)
  btnLabel: string;
  btnTextColor: string;
  href: string;
  delay?: number;
}

function PlatformCard({
  logo, tagline, badge, features, accent, accent2,
  btnLabel, btnTextColor, href, delay = 0,
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="relative rounded-3xl p-7 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(16,15,26,0.92) 0%, rgba(6,6,12,0.96) 100%)",
        border: `1px solid ${accent}33`,
        boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 50px ${accent}1a, inset 0 1px 0 rgba(255,255,255,0.05)`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Üst köşe parlaması */}
      <div
        className="pointer-events-none"
        style={{
          position: "absolute", top: -60, right: -40, width: 220, height: 220,
          background: `radial-gradient(circle, ${accent}40 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />

      {badge && (
        <div
          className="absolute top-5 right-5 z-10 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${accent}22`, border: `1px solid ${accent}66`, color: accent }}
        >
          <Star className="h-2.5 w-2.5 fill-current" />
          EN POPÜLER
        </div>
      )}

      {/* Logo bölgesi (parlayan hero) */}
      <div className="relative flex flex-col items-center text-center pt-5 pb-7">
        {/* logo arkası glow */}
        <div
          className="pointer-events-none"
          style={{
            position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)",
            width: 220, height: 130,
            background: `radial-gradient(ellipse, ${accent}55 0%, transparent 65%)`,
            filter: "blur(34px)",
          }}
        />
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative"
          style={{ filter: `drop-shadow(0 6px 22px ${accent}aa)` }}
        >
          {logo}
        </motion.div>
        <p className="relative text-slate-400 text-sm mt-4 max-w-[230px] leading-relaxed">{tagline}</p>
      </div>

      {/* Ayraç */}
      <div className="h-px w-full mb-6" style={{ background: `linear-gradient(90deg, transparent, ${accent}55, transparent)` }} />

      {/* Özellikler */}
      <ul className="space-y-3 flex-1 mb-7">
        {features.map((f) => (
          <FeatureRow key={f.label} icon={f.icon} label={f.label} color={accent} />
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={href}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accent2})`, color: btnTextColor, boxShadow: `0 10px 28px ${accent}55` }}
      >
        {btnLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const mouseX = useMotionValue(-9999);
  const mouseY = useMotionValue(-9999);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouseX.set(e.clientX); mouseY.set(e.clientY); };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#050508" }}>

      {/* ══ Arka plan ══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Mor gradient — sağ üst */}
        <div
          className="absolute -top-20 right-0 w-[55vw] h-[70vh]"
          style={{ background: "radial-gradient(ellipse at top right, rgba(88,28,220,0.45) 0%, rgba(60,20,180,0.15) 40%, transparent 70%)" }}
        />
        {/* Işık şeridi — sağ üst köşe */}
        <div
          className="absolute top-0 right-0 w-1 h-[70vh] opacity-60"
          style={{
            background: "linear-gradient(180deg, rgba(168,85,247,0.8) 0%, rgba(139,92,246,0.3) 50%, transparent 100%)",
            boxShadow: "0 0 30px 8px rgba(139,92,246,0.3)",
            transform: "translateX(-60px) rotate(8deg) translateY(-50px)",
          }}
        />
        {/* Turuncu çizgi sol-orta */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 w-[45vw] h-px"
          style={{ background: "linear-gradient(90deg, rgba(245,158,11,0.6), rgba(245,158,11,0.1), transparent)", boxShadow: "0 0 20px 4px rgba(245,158,11,0.08)" }}
        />
        {/* Mouse spotlight */}
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(109,40,217,0.12) 0%, transparent 70%)",
            x: mouseX, y: mouseY, translateX: "-50%", translateY: "-50%",
          }}
        />
      </div>

      {/* ══ Navbar ══ */}
      <nav className="relative z-20 flex items-center justify-between px-8 md:px-16 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/">
          <Logo size={40} />
        </Link>

        <div className="hidden md:flex items-center gap-10">
          {["Ana Sayfa", "Özellikler", "Fiyatlandırma", "Entegrasyonlar", "Kaynaklar"].map((l, i) => (
            <a
              key={l}
              href="#"
              className="relative text-[#9ca3af] hover:text-white text-sm transition-colors duration-200 group"
            >
              {l}
              {i === 0 && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-violet-500" />
              )}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold px-5 py-2.5 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            Giriş Yap
          </Link>
          <Link
            href="/register"
            className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:bg-violet-600/20"
            style={{ border: "1px solid rgba(124,58,237,0.5)", background: "rgba(124,58,237,0.1)" }}
          >
            Kayıt Ol
          </Link>
        </div>
      </nav>

      {/* ══ Hero ══ */}
      <section className="relative z-10 text-center pt-8 pb-6 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest px-4 py-2 rounded-full mb-5"
          style={{ border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.1)", color: "#a78bfa" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          YAPAY ZEKA DESTEKLİ PAZAR YERİ OTOMASYONU
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="font-black leading-[1.08] mb-4"
          style={{ fontSize: "clamp(2.2rem, 5.5vw, 4.2rem)" }}
        >
          Pazar Yeri İşinizi
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #818cf8 0%, #a78bfa 35%, #c084fc 70%, #e879f9 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AI ile Ölçeklendirin
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="text-[#9ca3af] text-base max-w-xl mx-auto leading-relaxed"
        >
          Amazon, eBay ve Etsy satıcıları için tam otomasyonlu çözümler.
          Listeleme, sipariş, stok ve müşteriyi tek platformdan yönetin.
        </motion.p>
      </section>

      {/* ══ Platform Kartları ══ */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Amazon */}
          <PlatformCard
            delay={0.25}
            badge
            logo={
              <div className="inline-block">
                <span className="text-[2.8rem] font-black text-white leading-none tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                  amazon
                </span>
                <svg width="150" height="20" viewBox="0 0 150 20" fill="none" className="mt-1.5 mx-auto block">
                  <path d="M10 7 C 52 23, 102 23, 138 8" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                  <path d="M138 8 L129 6.5 M138 8 L133 15" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
            }
            tagline="Amazon mağazanı bağla, ürünleri ve siparişleri otomatik yönet."
            features={AMAZON_FEATURES}
            accent="#f59e0b"
            accent2="#d97706"
            btnLabel="Amazon'u Bağla"
            btnTextColor="#000"
            href="/amazon"
          />

          {/* eBay */}
          <PlatformCard
            delay={0.35}
            logo={
              <span className="text-[3rem] font-black leading-none tracking-tight">
                <span style={{ color: "#ef4444" }}>e</span>
                <span style={{ color: "#3b82f6" }}>b</span>
                <span style={{ color: "#f59e0b" }}>a</span>
                <span style={{ color: "#22c55e" }}>y</span>
              </span>
            }
            tagline="eBay mağazanı bağla, otomatik listele, fiyatla ve sat."
            features={EBAY_FEATURES}
            accent="#3b82f6"
            accent2="#1d4ed8"
            btnLabel="eBay'i Bağla"
            btnTextColor="#fff"
            href="/dashboard"
          />

          {/* Etsy */}
          <PlatformCard
            delay={0.45}
            logo={
              <span
                className="text-[3rem] font-black leading-none tracking-tight"
                style={{ color: "#f97316", fontFamily: "Georgia, serif" }}
              >
                Etsy
              </span>
            }
            tagline="Etsy mağazanı bağla, ürün ve mesajları otomatikleştir."
            features={ETSY_FEATURES}
            accent="#f97316"
            accent2="#ea580c"
            btnLabel="Etsy'i Bağla"
            btnTextColor="#fff"
            href="/etsy"
          />
        </div>
      </section>

      {/* ══ Stats Bar ══ */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.65 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4">
            {STATS.map(({ icon: Icon, title, sub }, i) => (
              <div
                key={title}
                className="flex items-center gap-4 px-6 py-5"
                style={{
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <Icon className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ══ SSS (FAQ) ══ */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 pb-16">
        <FaqStructuredData />
        <h2 className="text-3xl md:text-4xl font-black text-center mb-3">Sık Sorulan Sorular</h2>
        <p className="text-slate-400 text-center mb-10">
          Amazon, eBay ve Etsy otomasyonu hakkında merak edilenler
        </p>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <summary className="flex items-center justify-between cursor-pointer list-none text-white font-semibold text-base">
                {item.q}
                <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-4" />
              </summary>
              <p className="text-slate-400 text-sm leading-relaxed mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ══ Footer ══ */}
      <footer className="relative z-10 px-8 md:px-16 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-bold text-slate-400 text-sm">Lean Automation</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 Lean Automation. Tüm hakları saklıdır.</p>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Gizlilik</a>
            <a href="#" className="hover:text-white transition-colors">Kullanım Şartları</a>
            <a href="#" className="hover:text-white transition-colors">İletişim</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
