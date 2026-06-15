"use client";

import { useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import Link from "next/link";
import {
  RefreshCcw, ShoppingCart, Cpu, Target, BarChart2,
  Upload, DollarSign, RotateCcw, FileBarChart,
  Package, MessageSquare, TrendingUp, HeartHandshake,
  Shield, Lock, Server, Headphones, Star, ArrowRight,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";

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

// ─── 3D Küp ───────────────────────────────────────────────────────────────────

const CUBE_SIZE = 96;
const CUBE_HALF = CUBE_SIZE / 2;

function Cube3D({
  accent,
  children,
}: {
  accent: string;   // hex renk, örn "#f59e0b"
  children: React.ReactNode;
}) {
  const face: React.CSSProperties = {
    position: "absolute",
    width: CUBE_SIZE,
    height: CUBE_SIZE,
    borderRadius: 4,
    border: `1px solid ${accent}88`,
    boxShadow: `inset 0 0 34px ${accent}33`,
    overflow: "hidden",
  };

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: CUBE_SIZE, height: CUBE_SIZE, perspective: 650 }}
    >
      {/* Zemin parlaması (dolgu) */}
      <div
        style={{
          position: "absolute", bottom: -24, left: "50%",
          width: CUBE_SIZE * 1.5, height: 38, transform: "translateX(-50%)",
          borderRadius: "50%",
          background: `radial-gradient(ellipse, ${accent}dd 0%, ${accent}55 42%, transparent 72%)`,
          filter: "blur(9px)",
        }}
      />
      {/* Zemin halkası (çember) */}
      <div
        style={{
          position: "absolute", bottom: -15, left: "50%",
          width: CUBE_SIZE * 1.02, height: 18, transform: "translateX(-50%)",
          borderRadius: "50%",
          border: `2px solid ${accent}`,
          boxShadow: `0 0 24px 2px ${accent}, inset 0 0 12px ${accent}`,
          opacity: 0.7,
        }}
      />
      {/* Ortam parlaması — küpün arkasında (filter'ı küpe koyamayız, 3D'yi düzleştirir) */}
      <div
        style={{
          position: "absolute", inset: 0, transform: "scale(1.6)",
          background: `radial-gradient(circle, ${accent}77 0%, transparent 66%)`,
          filter: "blur(22px)",
          zIndex: 0,
        }}
      />
      {/* Küp gövdesi — dış katman: yüzme (float) */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: CUBE_SIZE, height: CUBE_SIZE, position: "relative", zIndex: 1,
          transformStyle: "preserve-3d",
        }}
      >
        {/* İç katman: 3D dönüş (düz CSS — framer dokunmuyor) */}
        <div
          style={{
            width: CUBE_SIZE, height: CUBE_SIZE, position: "absolute", inset: 0,
            transformStyle: "preserve-3d",
            transform: "rotateX(-24deg) rotateY(-34deg)",
          }}
        >
          {/* Ön yüz */}
          <div
            style={{
              ...face,
              transform: `translateZ(${CUBE_HALF}px)`,
              background: `linear-gradient(150deg, rgba(48,44,64,1) 0%, rgba(14,13,22,1) 55%, rgba(6,6,11,1) 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {/* cam parlaması (gloss) */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 26%, transparent 52%)", pointerEvents: "none" }} />
            {/* iç renk halesi */}
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 60%, ${accent}33 0%, transparent 60%)`, pointerEvents: "none" }} />
            {/* üst kenar ışık */}
            <div style={{ position: "absolute", top: 0, left: 6, right: 6, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.9 }} />
            <div style={{ position: "relative", filter: `drop-shadow(0 0 18px ${accent}) drop-shadow(0 0 7px ${accent})` }}>{children}</div>
          </div>
          {/* Sağ yüz (gölge tarafı) */}
          <div
            style={{
              ...face,
              transform: `rotateY(90deg) translateZ(${CUBE_HALF}px)`,
              background: `linear-gradient(150deg, rgba(20,18,30,1) 0%, rgba(2,2,5,1) 100%)`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${accent}22, transparent 70%)`, pointerEvents: "none" }} />
          </div>
          {/* Üst yüz (ışık alan taraf) */}
          <div
            style={{
              ...face,
              transform: `rotateX(90deg) translateZ(${CUBE_HALF}px)`,
              background: `linear-gradient(150deg, ${accent}66 0%, rgba(30,28,42,1) 70%)`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(255,255,255,0.18), transparent 50%)", pointerEvents: "none" }} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Platform kartı ───────────────────────────────────────────────────────────

interface CardProps {
  logo: React.ReactNode;
  badge?: boolean;
  features: { icon: React.ElementType; label: string }[];
  featureColor: string;
  borderColor: string;
  glowColor: string;
  btnLabel: string;
  btnStyle: React.CSSProperties;
  cubeAccent: string;
  cubeContent: React.ReactNode;
  href: string;
  delay?: number;
}

function PlatformCard({
  logo, badge, features, featureColor, borderColor,
  glowColor, btnLabel, btnStyle, cubeAccent, cubeContent, href, delay = 0,
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="relative rounded-2xl p-5 flex flex-col"
      style={{
        background: "rgba(6,6,14,0.92)",
        border: `1px solid ${borderColor}`,
        boxShadow: `0 0 50px ${glowColor}, inset 0 0 60px rgba(0,0,0,0.3)`,
        backdropFilter: "blur(24px)",
      }}
    >
      {badge && (
        <div
          className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full"
          style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", color: "#fbbf24" }}
        >
          <Star className="h-2.5 w-2.5 fill-current" />
          EN POPÜLER
        </div>
      )}

      {/* Logo + Küp */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="pt-1">{logo}</div>
        <Cube3D accent={cubeAccent}>{cubeContent}</Cube3D>
      </div>

      {/* Özellikler */}
      <ul className="space-y-2.5 flex-1 mb-5">
        {features.map((f) => (
          <FeatureRow key={f.label} icon={f.icon} label={f.label} color={featureColor} />
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={href}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        style={btnStyle}
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

        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:bg-violet-600/20"
          style={{ border: "1px solid rgba(124,58,237,0.5)", background: "rgba(124,58,237,0.1)" }}
        >
          <span className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="bg-current rounded-[1px]" />
            ))}
          </span>
          Panel
        </Link>
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
              <div>
                <p className="text-[2.2rem] font-black text-white leading-none tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
                  amazon
                </p>
                <div className="mt-1 flex items-center">
                  <div className="h-0.5 w-[52%] rounded-full" style={{ background: "linear-gradient(90deg, #f59e0b, #fb923c 60%, transparent)" }} />
                  <div className="w-2 h-2 rounded-full border-2 border-amber-400 -ml-1 flex items-center justify-center">
                    <div className="w-0.5 h-0.5 bg-amber-400 rounded-full" />
                  </div>
                </div>
              </div>
            }
            features={AMAZON_FEATURES}
            featureColor="#f59e0b"
            borderColor="rgba(245,158,11,0.35)"
            glowColor="rgba(245,158,11,0.1)"
            btnLabel="Amazon'u Bağla"
            btnStyle={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", color: "#000" }}
            cubeAccent="#f59e0b"
            cubeContent={
              <span className="text-4xl font-black text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                a
              </span>
            }
            href="/dashboard/amazon"
          />

          {/* eBay */}
          <PlatformCard
            delay={0.35}
            logo={
              <span className="text-[2.6rem] font-black leading-none tracking-tight">
                <span style={{ color: "#ef4444" }}>e</span>
                <span style={{ color: "#3b82f6" }}>b</span>
                <span style={{ color: "#f59e0b" }}>a</span>
                <span style={{ color: "#22c55e" }}>y</span>
              </span>
            }
            features={EBAY_FEATURES}
            featureColor="#3b82f6"
            borderColor="rgba(59,130,246,0.4)"
            glowColor="rgba(59,130,246,0.12)"
            btnLabel="eBay'i Bağla"
            btnStyle={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff" }}
            cubeAccent="#3b82f6"
            cubeContent={
              <span className="text-2xl font-black leading-none">
                <span style={{ color: "#ef4444" }}>e</span>
                <span style={{ color: "#60a5fa" }}>b</span>
                <span style={{ color: "#fbbf24" }}>a</span>
                <span style={{ color: "#4ade80" }}>y</span>
              </span>
            }
            href="/dashboard/listings"
          />

          {/* Etsy */}
          <PlatformCard
            delay={0.45}
            logo={
              <span
                className="text-[2.6rem] font-black leading-none tracking-tight"
                style={{ color: "#f97316" }}
              >
                Etsy
              </span>
            }
            features={ETSY_FEATURES}
            featureColor="#f97316"
            borderColor="rgba(249,115,22,0.35)"
            glowColor="rgba(249,115,22,0.1)"
            btnLabel="Etsy'i Bağla"
            btnStyle={{ background: "linear-gradient(135deg,#f97316,#ea580c)", color: "#fff" }}
            cubeAccent="#f97316"
            cubeContent={
              <span
                className="text-4xl font-black"
                style={{ color: "#f97316", fontFamily: "Georgia, serif" }}
              >
                E
              </span>
            }
            href="/dashboard/etsy"
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
