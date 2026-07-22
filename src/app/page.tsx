"use client";

// Ana sayfa — "komuta merkezi" konsepti (2026-07-18 yeniden tasarım):
// sayfanın kendisi ürünün demosu gibi davranır — hero'da canlı otomasyon hattı
// (AliExpress → ortak depo → 4 kanal) ve akan olay kaydı. Degrade yazı, eyebrow
// enflasyonu ve birbirinin aynı kart gridleri bilinçli olarak YOK (impeccable).

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  RefreshCcw, ShoppingCart, Cpu, Upload, DollarSign,
  Package, TrendingUp, Shield, Lock, Headphones, ArrowRight, ChevronDown,
  Clapperboard, Megaphone, ImageIcon, Radar, Warehouse, CheckCircle2,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { FAQ } from "@/lib/faq";
import { FaqStructuredData } from "@/components/structured-data";

/** Demo videosu (YouTube/Vimeo embed). Boşken şık yer tutucu görünür. */
const DEMO_VIDEO_URL = "";

const EASE = [0.19, 1, 0.22, 1] as const; // ease-out-expo

// ─── Canlı olay akışı (hero) ──────────────────────────────────────────────────
// Gerçek sistem terminolojisi — sahte metrik değil, motorun gerçekten yaptığı işler.
const FEED_EVENTS = [
  { icon: RefreshCcw, text: "Stok senkronu · 42 ürün tarandı", tone: "#22c55e" },
  { icon: Upload, text: "Oto-yükleme · 3 yeni ürün eBay'e listelendi", tone: "#3b82f6" },
  { icon: ShoppingCart, text: "Sipariş yakalandı · kaynak doğrulandı", tone: "#96bf48" },
  { icon: DollarSign, text: "Fiyat güncellendi · marj korundu", tone: "#f59e0b" },
  { icon: ImageIcon, text: "AI görsel seti üretildi · 3 fotoğraf", tone: "#a78bfa" },
  { icon: Package, text: "Takip kodu çevrildi · alıcıya iletildi", tone: "#22c55e" },
];

function LiveFeed() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 2600);
    return () => clearInterval(t);
  }, []);
  // Son 3 olay görünür; en yeni üstte
  const rows = [0, 1, 2].map((i) => FEED_EVENTS[(tick + FEED_EVENTS.length - i) % FEED_EVENTS.length]);
  return (
    <div className="space-y-2" aria-hidden>
      {rows.map((e, i) => {
        const Icon = e.icon;
        return (
          <motion.div
            key={`${tick}-${i}`}
            initial={i === 0 ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1 - i * 0.35, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: e.tone }} />
            <span className="text-slate-300 truncate">{e.text}</span>
            <span className="ml-auto text-slate-600 tabular-nums">az önce</span>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Otomasyon hattı görseli (hero sağ sahne) ─────────────────────────────────
// Saf SVG + CSS offset-path: ürün "paketleri" depodan 4 kanala akar.
const CHANNELS = [
  { label: "Amazon", color: "#f59e0b", y: 30 },
  { label: "eBay", color: "#3b82f6", y: 100 },
  { label: "Etsy", color: "#f97316", y: 170 },
  { label: "Shopify", color: "#96bf48", y: 240 },
];

function PipelineScene() {
  return (
    <div
      className="relative rounded-3xl p-6 md:p-8 overflow-hidden"
      style={{
        background: "linear-gradient(160deg, rgba(20,16,38,0.9) 0%, rgba(7,7,14,0.95) 100%)",
        border: "1px solid rgba(124,58,237,0.25)",
        boxShadow: "0 40px 90px rgba(0,0,0,0.6), 0 0 80px rgba(124,58,237,0.12)",
      }}
    >
      {/* İç ışık */}
      <div className="absolute -top-24 -right-16 w-72 h-72 pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.28), transparent 70%)", filter: "blur(40px)" }} />

      <div className="relative flex items-center justify-between gap-4">
        {/* Kaynak: Radar + Depo */}
        <div className="flex flex-col items-center gap-3 flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.45)" }}>
            <Radar className="h-6 w-6 text-violet-300 pipeline-radar" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-bold text-white leading-tight">Radar</p>
            <p className="text-[10px] text-slate-500">kazananları bulur</p>
          </div>
          <div className="w-px h-6" style={{ background: "rgba(124,58,237,0.4)" }} />
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.45)" }}>
            <Warehouse className="h-6 w-6 text-violet-300" />
          </div>
          <div className="text-center">
            <p className="text-[11px] font-bold text-white leading-tight">Ortak Depo</p>
            <p className="text-[10px] text-slate-500">1.500 ürün</p>
          </div>
        </div>

        {/* Akış hatları */}
        <div className="relative flex-1 h-[270px] min-w-0" aria-hidden>
          <svg viewBox="0 0 200 270" className="w-full h-full" fill="none" preserveAspectRatio="none">
            {CHANNELS.map((c) => (
              <path
                key={c.label}
                d={`M 0 135 C 80 135, 110 ${c.y}, 200 ${c.y}`}
                stroke={`${c.color}44`}
                strokeWidth="1.5"
              />
            ))}
          </svg>
          {/* Akan paketler — CSS motion path; reduced-motion'da gizlenir */}
          {CHANNELS.map((c, i) => (
            <span
              key={c.label}
              className="pipeline-dot"
              style={{
                background: c.color,
                boxShadow: `0 0 10px ${c.color}`,
                offsetPath: `path('M 0 135 C 80 135, 110 ${c.y}, 200 ${c.y}')`,
                animationDelay: `${i * 0.9}s`,
              }}
            />
          ))}
        </div>

        {/* Kanallar */}
        <div className="flex flex-col gap-3 flex-shrink-0">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
              style={{ background: `${c.color}12`, border: `1px solid ${c.color}3a` }}>
              <span className="w-2 h-2 rounded-full pipeline-pulse" style={{ background: c.color }} />
              <span className="text-xs font-bold text-white">{c.label}</span>
              <CheckCircle2 className="h-3.5 w-3.5 ml-1" style={{ color: c.color }} />
            </div>
          ))}
        </div>
      </div>

      {/* Canlı kayıt */}
      <div className="relative mt-6 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pipeline-pulse" />
          <p className="text-[11px] font-bold text-slate-400">SİSTEM KAYDI — canlı</p>
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}

// ─── Sayaç ────────────────────────────────────────────────────────────────────
// SEO/no-JS güvenli: sunucu HTML'i (ve JS çalışmayan tarayıcılar) HER ZAMAN
// gerçek nihai değeri görür — sayma animasyonu yalnız görünür durumdaki bir
// EKLENTİ, doğru değerin görünürlüğünü JS'e bağlamaz (impeccable: "reveal
// animasyonları zaten görünen bir varsayılanı GÜÇLENDİRİR, gizlemez").
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(to); // ilk render = gerçek değer (SSR/no-JS için doğru)

  useEffect(() => {
    if (!inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setVal(0);
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 4)))); // ease-out-quart
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to]);

  return <span ref={ref} className="tabular-nums">{val.toLocaleString("tr-TR")}{suffix}</span>;
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#050508" }}>
      {/* Sayfa animasyon stilleri + reduced-motion alternatifi */}
      <style>{`
        .pipeline-dot{position:absolute;top:0;left:0;width:7px;height:7px;border-radius:9999px;offset-rotate:0deg;animation:pipeFlow 3.6s cubic-bezier(0.4,0,0.6,1) infinite}
        @keyframes pipeFlow{0%{offset-distance:0%;opacity:0}12%{opacity:1}88%{opacity:1}100%{offset-distance:100%;opacity:0}}
        .pipeline-pulse{animation:pulseDot 2.2s ease-in-out infinite}
        @keyframes pulseDot{0%,100%{opacity:1}50%{opacity:0.35}}
        .pipeline-radar{animation:radarSpin 5s linear infinite}
        @keyframes radarSpin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){
          .pipeline-dot{animation:none;opacity:0}
          .pipeline-pulse,.pipeline-radar{animation:none}
        }
      `}</style>

      {/* Arka plan: mor drench hero ışığı */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[110vw] h-[75vh]"
          style={{ background: "radial-gradient(ellipse at top, rgba(88,28,220,0.35) 0%, rgba(60,20,180,0.1) 45%, transparent 72%)" }} />
        <div className="absolute bottom-0 right-0 w-[45vw] h-[40vh]"
          style={{ background: "radial-gradient(ellipse at bottom right, rgba(124,58,237,0.1), transparent 70%)" }} />
      </div>

      {/* ══ Navbar ══ */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 md:px-14 py-4"
        style={{ background: "rgba(5,5,8,0.78)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/"><Logo size={38} /></Link>
        <div className="hidden md:flex items-center gap-9">
          {[
            { label: "Platformlar", href: "#entegrasyonlar" },
            { label: "Motor", href: "#ozellikler" },
            { label: "AI Stüdyo", href: "#ai" },
            { label: "SSS", href: "#kaynaklar" },
          ].map(({ label, href }) => (
            <a key={label} href={href} className="text-slate-400 hover:text-white text-sm transition-colors duration-200">
              {label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2.5">
          {isAuthed ? (
            <button onClick={() => signOut({ callbackUrl: "/" })}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-colors">
              Çıkış Yap
            </button>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold px-4 py-2 rounded-xl text-slate-300 hover:text-white transition-colors">
                Giriş Yap
              </Link>
              <Link href="/register"
                className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-transform hover:scale-[1.03]"
                style={{ background: "#7c3aed", boxShadow: "0 8px 24px rgba(124,58,237,0.4)" }}>
                Ücretsiz Başla
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ══ HERO: sol metin / sağ canlı sahne ══ */}
      <section id="anasayfa" className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-14 md:pt-20 pb-16">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-10 items-center">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="font-black leading-[1.04] tracking-[-0.02em]"
              style={{ fontSize: "clamp(2.6rem, 5.2vw, 4.6rem)", textWrap: "balance" }}
            >
              E-ticaretin motoru.
              <br />
              <span style={{ color: "#a78bfa" }}>Sen kârına bak.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: EASE }}
              className="text-slate-300 text-base md:text-lg max-w-[52ch] leading-relaxed mt-6"
            >
              Radar kazanan ürünleri bulur, ortak depo besler; Amazon, eBay, Etsy ve
              Shopify mağazaların <span className="text-white font-semibold">kendi kendine</span> listelenir,
              fiyatlanır ve stok takibinde kalır. Sipariş düştüğünde sistem çoktan hazırdır.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22, ease: EASE }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link href="/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white text-[15px] transition-transform hover:scale-[1.03]"
                style={{ background: "#7c3aed", boxShadow: "0 14px 40px rgba(124,58,237,0.45)" }}>
                7 Gün Ücretsiz Başla <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#entegrasyonlar"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-slate-200 transition-colors hover:text-white"
                style={{ border: "1px solid rgba(255,255,255,0.14)" }}>
                Platformları Gör
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400"
            >
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-400" /> Kredi kartı gerekmez</span>
              <span className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-emerald-400" /> Mağaza başına 7 gün / 50 ürün</span>
              <span className="flex items-center gap-1.5"><Headphones className="h-3.5 w-3.5 text-emerald-400" /> 7/24 canlı destek</span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          >
            <PipelineScene />
          </motion.div>
        </div>
      </section>

      {/* ══ Rakam şeridi ══ */}
      <section className="relative z-10 border-y" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: 1500, s: "", label: "ürünlük ortak depo" },
            { v: 4, s: "", label: "platform, tek panel" },
            { v: 15, s: " dk", label: "kritik üründe en hızlı tarama" },
            { v: 24, s: "/7", label: "kesintisiz takip" },
          ].map(({ v, s, label }) => (
            <div key={label}>
              <p className="text-3xl md:text-4xl font-black text-white"><Counter to={v} suffix={s} /></p>
              <p className="text-xs text-slate-400 mt-1.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══ Platform sahnesi ══ */}
      <section id="entegrasyonlar" className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-20 scroll-mt-24">
        <h2 className="text-3xl md:text-[2.6rem] font-black text-center leading-tight" style={{ textWrap: "balance" }}>
          Dört pazar yeri. Tek motor.
        </h2>
        <p className="text-slate-400 text-center mt-3 mb-12 max-w-xl mx-auto">
          Her kanal kendi paneliyle çalışır; depo, fiyatlama ve stok zekâsı hepsinde ortaktır.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {[
            {
              name: "Amazon", href: "/amazon", color: "#f59e0b",
              video: "/videos/amazon-logo.mp4",
              desc: "Depodan yükle; Buy Box, stok ve siparişler otomatik.",
              feats: ["Stok senkronu", "Sipariş otomasyonu", "Kâr analitiği"],
            },
            {
              name: "eBay", href: "/dashboard", color: "#3b82f6",
              video: "/videos/ebay-logo.mp4",
              desc: "Otomatik listele, akıllı fiyatla, kargo takibini sisteme bırak.",
              feats: ["Oto-listeleme", "Akıllı fiyat", "Takip kodu"],
            },
            {
              name: "Etsy", href: "/etsy", color: "#f97316",
              video: "/videos/etsy-logo.mp4",
              desc: "Ürün yayınlama ve mesaj otomasyonu tek panelde.",
              feats: ["Ürün yayınlama", "Mesaj AI", "Mağaza analitiği"],
            },
            {
              name: "Shopify", href: "/shopify", color: "#96bf48",
              video: "/videos/shopify-logo.mp4",
              desc: "Mağazanı bağla; AI görseller, siparişler ve stok kendiliğinden.",
              feats: ["AI ürün görselleri", "Sipariş yakalama", "Meta feed"],
            },
          ].map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group relative rounded-3xl overflow-hidden flex flex-col"
              style={{
                background: "linear-gradient(180deg, rgba(15,14,24,0.9), rgba(7,7,12,0.95))",
                border: `1px solid ${p.color}30`,
                boxShadow: `0 24px 60px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Video sahnesi — logolar BÜYÜK */}
              <div className="relative h-44 flex items-center justify-center overflow-hidden"
                style={{ background: `radial-gradient(circle at 50% 60%, ${p.color}1f, transparent 70%)` }}>
                {p.video ? (
                  <video src={p.video} autoPlay muted loop playsInline aria-label={p.name}
                    className="h-40 w-40 object-cover transition-transform duration-500 group-hover:scale-110"
                    style={{ mixBlendMode: "screen" }} />
                ) : (
                  <span className="text-[3.4rem] font-black leading-none tracking-tight transition-transform duration-500 group-hover:scale-110">
                    <span style={{ color: "#ef4444" }}>e</span>
                    <span style={{ color: "#3b82f6" }}>b</span>
                    <span style={{ color: "#f59e0b" }}>a</span>
                    <span style={{ color: "#22c55e" }}>y</span>
                  </span>
                )}
              </div>

              <div className="p-6 pt-4 flex flex-col flex-1">
                <p className="text-slate-300 text-sm leading-relaxed">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5 mt-4 mb-6">
                  {p.feats.map((f) => (
                    <span key={f} className="text-[11px] font-medium rounded-full px-2.5 py-1"
                      style={{ color: p.color, background: `${p.color}14`, border: `1px solid ${p.color}33` }}>
                      {f}
                    </span>
                  ))}
                </div>
                <Link href={p.href}
                  className="mt-auto inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90"
                  style={{ background: p.color }}>
                  {p.name} Panelini Aç <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ Motor: 3 gerçek adım ══ */}
      <section id="ozellikler" className="relative z-10 max-w-5xl mx-auto px-6 py-16 scroll-mt-24">
        <h2 className="text-3xl md:text-[2.6rem] font-black text-center leading-tight" style={{ textWrap: "balance" }}>
          Motor arkada nasıl çalışıyor?
        </h2>
        <p className="text-slate-400 text-center mt-3 mb-12">Pazarlama cilası değil — sistemin gerçek akışı bu.</p>

        <div className="relative">
          {/* Bağlayıcı hat (masaüstü) */}
          <div className="hidden md:block absolute top-7 left-[16%] right-[16%] h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5), transparent)" }} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Radar, title: "Radar keşfeder", desc: "Sistem AliExpress'i sürekli tarar; puan, satış ve marj kanıtı olan ürünleri seçip ortak depoya yazar." },
              { icon: Warehouse, title: "Depo besler", desc: "1.500 ürünlük havuzdan seçersin; fiyat pazara göre hesaplanır, AI görselleri hazırlanır, kanalına yüklenir." },
              { icon: TrendingUp, title: "Senkron korur", desc: "Ürünler riskine göre taranır: çok satan/az stoklu ürünlerde 15 dakikaya kadar, normalde saatlik. Kaynak stok biterse ilanın anında durdurulur." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12, ease: EASE }}
                className="relative text-center md:text-left"
              >
                <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center mx-auto md:mx-0 mb-5"
                  style={{ background: "rgba(124,58,237,0.16)", border: "1px solid rgba(124,58,237,0.5)" }}>
                  <Icon className="h-6 w-6 text-violet-300" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-[36ch] mx-auto md:mx-0">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Demo video alanı */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative rounded-2xl overflow-hidden mt-14"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {DEMO_VIDEO_URL ? (
            <div className="aspect-video w-full">
              <iframe src={DEMO_VIDEO_URL} title="Lean Automation Demo" className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          ) : (
            /* Remotion ile üretilen ürün turu (demo-video/) — sessiz döngü + kontroller */
            <video
              src="/videos/demo.mp4"
              className="aspect-video w-full"
              autoPlay
              muted
              loop
              playsInline
              controls
              aria-label="Lean Automation ürün turu"
            />
          )}
        </motion.div>
      </section>

      {/* ══ AI Stüdyo — asimetrik vitrin ══ */}
      <section id="ai" className="relative z-10 max-w-6xl mx-auto px-6 py-16 scroll-mt-24">
        <h2 className="text-3xl md:text-[2.6rem] font-black text-center leading-tight" style={{ textWrap: "balance" }}>
          İçini açınca AI var.
        </h2>
        <p className="text-slate-400 text-center mt-3 mb-12 max-w-xl mx-auto">
          Görsel, video ve reklam metni — üçü de 300.000 başarılı reklam analizinden süzülen kurallarla üretilir.
        </p>

        <div className="grid md:grid-cols-[1.3fr_1fr] gap-5">
          {/* Büyük panel: UGC video */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, ease: EASE }}
            className="rounded-3xl p-8 md:p-10 flex flex-col justify-between min-h-[300px]"
            style={{
              background: "linear-gradient(150deg, rgba(124,58,237,0.2), rgba(10,8,20,0.9) 60%)",
              border: "1px solid rgba(124,58,237,0.4)",
            }}
          >
            <div>
              <Clapperboard className="h-8 w-8 text-violet-300 mb-5" />
              <h3 className="text-2xl font-black text-white mb-3" style={{ textWrap: "balance" }}>
                Ürününe konuşan UGC videosu — dakikalar içinde
              </h3>
              <p className="text-slate-300 text-sm leading-relaxed max-w-[48ch]">
                Bir oyuncu fotoğrafı yükle: AI ürünü eline yerleştirir, doğal İngilizce
                konuşmayı yazar, seslendirir ve reklama hazır videoyu üretir.
                Cilalı reklam dili yok — gerçek insan anlatısı var.
              </p>
            </div>
            <p className="text-violet-300 text-xs font-bold mt-6">Kredi cüzdanından, video başına ödeme · başarısız üretimde otomatik iade</p>
          </motion.div>

          {/* Dikey iki panel */}
          <div className="flex flex-col gap-5">
            {[
              { icon: ImageIcon, title: "AI ürün görselleri", desc: "Yüklediğin her ürün için stüdyo, kullanım ve detay çekimi — satış kanalına optimize edilmiş 3 profesyonel fotoğraf." },
              { icon: Megaphone, title: "AI kampanya taslağı", desc: "Ürünü önce araştırır, sonra Meta reklam başlığını, metinlerini ve hedef kitleyi yazar. Kopyala, yapıştır, yayınla." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: EASE }}
                className="rounded-3xl p-7 flex-1"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Icon className="h-6 w-6 text-violet-300 mb-4" />
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ Güven satırı ══ */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-slate-400 rounded-2xl py-6 px-8"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-emerald-400" /> %99.9 uptime</span>
          <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-emerald-400" /> Şifreli API bağlantıları</span>
          <span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-emerald-400" /> Kurumsal altyapı</span>
          <span className="flex items-center gap-2"><Headphones className="h-4 w-4 text-emerald-400" /> 7/24 gerçek insan desteği</span>
        </div>
      </section>

      {/* ══ SSS ══ */}
      <section id="kaynaklar" className="relative z-10 max-w-3xl mx-auto px-6 pb-16 scroll-mt-24">
        <FaqStructuredData />
        <h2 className="text-3xl md:text-[2.6rem] font-black text-center leading-tight mb-3" style={{ textWrap: "balance" }}>
          Sık Sorulan Sorular
        </h2>
        <p className="text-slate-400 text-center mb-10">Amazon, eBay, Etsy ve Shopify otomasyonu hakkında merak edilenler</p>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details key={item.q} className="group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <summary className="flex items-center justify-between cursor-pointer list-none text-white font-semibold text-base">
                {item.q}
                <ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-open:rotate-180 flex-shrink-0 ml-4" />
              </summary>
              <p className="text-slate-400 text-sm leading-relaxed mt-3">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ══ Kapanış CTA ══ */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE }}
          className="rounded-3xl py-14 px-8"
          style={{
            background: "radial-gradient(circle at 50% 0%, rgba(124,58,237,0.28), rgba(8,7,14,0.9) 70%)",
            border: "1px solid rgba(124,58,237,0.35)",
          }}
        >
          <h2 className="text-3xl md:text-4xl font-black leading-tight" style={{ textWrap: "balance" }}>
            Motoru çalıştır. Gerisini izle.
          </h2>
          <p className="text-slate-300 mt-4 max-w-md mx-auto">
            Mağazanı bağla — 7 gün, 50 ürün, kredi kartı yok.
          </p>
          <Link href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white mt-8 transition-transform hover:scale-[1.03]"
            style={{ background: "#7c3aed", boxShadow: "0 14px 40px rgba(124,58,237,0.5)" }}>
            7 Gün Ücretsiz Başla <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* ══ Footer ══ */}
      <footer className="relative z-10 px-8 md:px-16 py-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark size={24} />
            <span className="font-bold text-slate-400 text-sm">Lean Automation</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-white transition-colors">Gizlilik</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Kullanım Şartları</Link>
            <span>© {new Date().getFullYear()} Lean Automation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
