"use client";

import { useEffect } from "react";
import { motion, useMotionValue } from "framer-motion";
import Link from "next/link";
import { Shield, Lock, Server, Headphones, ArrowRight, Star } from "lucide-react";

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Ana Sayfa",      href: "#" },
  { label: "Özellikler",    href: "#ozellikler" },
  { label: "Fiyatlandırma", href: "#fiyatlandirma" },
  { label: "Entegrasyonlar",href: "#entegrasyonlar" },
  { label: "Kaynaklar",     href: "#kaynaklar" },
];

// ─── Platform verileri ───────────────────────────────────────────────────────

interface Platform {
  id: string;
  badge: string | null;
  glowBorder: string;
  boxShadow: string;
  cubeGlow: string;
  btnGradient: string;
  btnColor: string;
  btnLabel: string;
  logo: React.ReactNode;
  cubeContent: React.ReactNode;
  features: string[];
  href: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "amazon",
    badge: "EN POPÜLER",
    glowBorder: "rgba(245,158,11,0.35)",
    boxShadow: "0 0 40px rgba(245,158,11,0.12), inset 0 0 40px rgba(245,158,11,0.03)",
    cubeGlow: "rgba(245,158,11,0.5)",
    btnGradient: "linear-gradient(135deg,#f59e0b,#d97706)",
    btnColor: "#000",
    btnLabel: "Amazon'u Bağla",
    logo: (
      <div className="flex flex-col items-start">
        <span className="text-3xl font-black text-white tracking-tighter leading-none">amazon</span>
        <div
          className="mt-1 h-0.5 w-16 rounded-full"
          style={{ background: "linear-gradient(90deg, #f59e0b, #fb923c)" }}
        />
      </div>
    ),
    cubeContent: <span className="text-3xl font-black text-amber-400">a</span>,
    features: [
      "Stok Senkronizasyonu",
      "Sipariş Otomasyonu",
      "AI Ürün Yönetimi",
      "Buy Box Takibi",
      "Kâr Analitiği",
    ],
    href: "/register",
  },
  {
    id: "ebay",
    badge: null,
    glowBorder: "rgba(59,130,246,0.35)",
    boxShadow: "0 0 40px rgba(59,130,246,0.15), inset 0 0 40px rgba(59,130,246,0.04)",
    cubeGlow: "rgba(59,130,246,0.5)",
    btnGradient: "linear-gradient(135deg,#2563eb,#1d4ed8)",
    btnColor: "#fff",
    btnLabel: "eBay'i Bağla",
    logo: (
      <span className="text-4xl font-black tracking-tight leading-none">
        <span className="text-red-500">e</span>
        <span className="text-blue-400">b</span>
        <span className="text-yellow-400">a</span>
        <span className="text-green-400">y</span>
      </span>
    ),
    cubeContent: (
      <span className="text-lg font-black leading-none">
        <span className="text-red-500">e</span>
        <span className="text-blue-400">b</span>
        <span className="text-yellow-400">a</span>
        <span className="text-green-400">y</span>
      </span>
    ),
    features: [
      "Otomatik Listeleme",
      "Akıllı Fiyatlandırma",
      "Sipariş Takibi",
      "İade Yönetimi",
      "Performans Raporları",
    ],
    href: "/register",
  },
  {
    id: "etsy",
    badge: null,
    glowBorder: "rgba(249,115,22,0.35)",
    boxShadow: "0 0 40px rgba(249,115,22,0.12), inset 0 0 40px rgba(249,115,22,0.03)",
    cubeGlow: "rgba(249,115,22,0.5)",
    btnGradient: "linear-gradient(135deg,#f97316,#ea580c)",
    btnColor: "#fff",
    btnLabel: "Etsy'i Bağla",
    logo: <span className="text-4xl font-black text-orange-500 tracking-tight leading-none">Etsy</span>,
    cubeContent: <span className="text-3xl font-black text-orange-400">E</span>,
    features: [
      "Ürün Yayınlama",
      "Mesaj Otomasyonu",
      "Stok Yönetimi",
      "Mağaza Analitiği",
      "Müşteri Destek AI",
    ],
    href: "/register",
  },
];

// ─── Stats ───────────────────────────────────────────────────────────────────

const STATS = [
  { Icon: Shield,     title: "%99.9 Uptime",       sub: "Kurumsal Güvenilirlik" },
  { Icon: Lock,       title: "Güvenli API",         sub: "Banka Düzeyinde Güvenlik" },
  { Icon: Server,     title: "Kurumsal Altyapı",    sub: "Ölçeklenebilir & Güvenilir" },
  { Icon: Headphones, title: "7/24 Destek",         sub: "Gerçek İnsanlar, Hızlı Çözüm" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCube({ glow, children }: { glow: string; children: React.ReactNode }) {
  return (
    <div className="relative w-24 h-24 animate-float flex-shrink-0" style={{ perspective: "600px" }}>
      {/* Glow blob behind */}
      <div
        className="absolute inset-0 rounded-2xl scale-150"
        style={{ background: glow, filter: "blur(18px)", opacity: 0.6 }}
      />
      {/* Cube face */}
      <div
        className="relative w-full h-full flex items-center justify-center rounded-2xl border border-white/10"
        style={{
          background: "linear-gradient(145deg, rgba(30,30,50,0.95), rgba(10,10,20,0.98))",
          transform: "rotateX(-10deg) rotateY(-14deg)",
          boxShadow: `0 20px 40px ${glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
      <circle cx="8" cy="8" r="7" stroke={color} strokeWidth="1.2" strokeOpacity="0.5" />
      <path d="M5.5 8l2 2 3-3" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURE_COLORS: Record<string, string> = {
  amazon: "#f59e0b",
  ebay: "#60a5fa",
  etsy: "#f97316",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">

      {/* ══ Arka Plan Efektleri ══ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Mor gradient — sağ üst */}
        <div
          className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(109,40,217,0.4) 0%, transparent 70%)" }}
        />
        {/* Turuncu yatay çizgi — sol orta */}
        <div
          className="absolute top-1/2 -left-10 w-[60vw] h-px opacity-60"
          style={{ background: "linear-gradient(90deg, transparent, rgba(245,158,11,0.5), transparent)", boxShadow: "0 0 30px 6px rgba(245,158,11,0.1)" }}
        />
        {/* Hafif mavi çizgi — sağ alt */}
        <div
          className="absolute bottom-1/3 -right-10 w-[40vw] h-px opacity-40"
          style={{ background: "linear-gradient(270deg, transparent, rgba(59,130,246,0.4), transparent)", boxShadow: "0 0 20px 4px rgba(59,130,246,0.08)" }}
        />
        {/* Mouse spotlight */}
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)",
            x: mouseX,
            y: mouseY,
            translateX: "-50%",
            translateY: "-50%",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* ══ Navbar ══ */}
      <nav className="relative z-20 flex items-center justify-between px-8 md:px-16 py-5 border-b border-white/5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-lg"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}
          >
            OB
          </div>
          <div className="leading-none">
            <p className="font-black text-white text-sm tracking-[0.2em]">OTO</p>
            <p className="text-slate-500 text-[10px] tracking-[0.2em] mt-0.5">OTOMASYON</p>
          </div>
        </Link>

        {/* Linkler */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="relative text-slate-400 hover:text-white text-sm transition-colors duration-200 group"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-violet-500 group-hover:w-full transition-all duration-300 rounded-full" />
            </a>
          ))}
        </div>

        {/* Dashboard Butonu */}
        <Link
          href="/dashboard"
          className="hidden md:flex items-center gap-2 border text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-200 hover:bg-violet-600/20"
          style={{ borderColor: "rgba(124,58,237,0.5)", background: "rgba(124,58,237,0.08)" }}
        >
          <span className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5">
            {[...Array(4)].map((_, i) => (
              <span key={i} className="bg-current rounded-[1px] opacity-80" />
            ))}
          </span>
          Panel
        </Link>

        {/* Mobile login */}
        <Link href="/login" className="md:hidden text-sm text-slate-400 hover:text-white transition-colors">
          Giriş
        </Link>
      </nav>

      {/* ══ Hero ══ */}
      <section className="relative z-10 text-center pt-16 pb-12 px-6">
        {/* Rozet */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-8 border"
          style={{
            color: "#a78bfa",
            borderColor: "rgba(124,58,237,0.3)",
            background: "rgba(124,58,237,0.08)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          YAPAY ZEKA DESTEKLİ PAZAR YERİ OTOMASYONU
        </motion.div>

        {/* Başlık */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.1] mb-6"
        >
          Pazar Yeri İşinizi
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #60a5fa 0%, #818cf8 40%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            AI ile Ölçeklendirin
          </span>
        </motion.h1>

        {/* Açıklama */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed"
        >
          Amazon, eBay ve Etsy satıcıları için tam otomasyonlu çözümler.
          <br />
          Listeleme, sipariş, stok ve müşteriyi tek platformdan yönetin.
        </motion.p>
      </section>

      {/* ══ Platform Kartları ══ */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLATFORMS.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 * i + 0.3, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="relative rounded-2xl p-6 flex flex-col"
              style={{
                background: "rgba(8,8,16,0.85)",
                border: `1px solid ${p.glowBorder}`,
                boxShadow: p.boxShadow,
                backdropFilter: "blur(24px)",
              }}
            >
              {/* Üst köşe rozeti */}
              {p.badge && (
                <div
                  className="absolute top-4 right-4 flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)", color: "#fbbf24" }}
                >
                  <Star className="h-3 w-3 fill-current" />
                  {p.badge}
                </div>
              )}

              {/* Logo + 3D Kutu */}
              <div className="flex items-start justify-between mb-7">
                <div className="pt-1">{p.logo}</div>
                <PlatformCube glow={p.cubeGlow}>{p.cubeContent}</PlatformCube>
              </div>

              {/* Özellikler */}
              <ul className="space-y-3.5 flex-1 mb-8">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-slate-300 text-sm">
                    <CheckIcon color={FEATURE_COLORS[p.id]} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA Butonu */}
              <Link
                href={p.href}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all duration-200 hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: p.btnGradient, color: p.btnColor }}
              >
                {p.btnLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ Alt Stats Bar ══ */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 divide-white/5" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {STATS.map(({ Icon, title, sub }, i) => (
              <div
                key={title}
                className="flex items-center gap-4 px-6 py-5"
                style={{
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                  borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : undefined,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
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
      <footer
        className="relative z-10 px-6 md:px-16 py-6 border-t"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] text-white"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
            >
              OB
            </div>
            <span className="font-bold text-slate-400 text-sm">OtoBot</span>
          </div>
          <p className="text-xs text-slate-600">© 2026 OtoBot. Tüm hakları saklıdır.</p>
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
