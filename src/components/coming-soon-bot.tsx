"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle2, type LucideIcon } from "lucide-react";
import { LogoMark } from "@/components/logo";

export interface BotFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
}

interface ComingSoonBotProps {
  botName: string;        // "AmazonBot"
  logo: React.ReactNode;  // platform logosu (büyük)
  accent: string;         // hex marka rengi
  description: string;
  features: BotFeature[];
}

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export function ComingSoonBot({ botName, logo, accent, description, features }: ComingSoonBotProps) {
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#050508" }}>
      {/* Arka plan parlaması */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-20 right-0 w-[55vw] h-[70vh]"
          style={{ background: `radial-gradient(ellipse at top right, ${accent}33 0%, transparent 70%)` }}
        />
        <div
          className="absolute bottom-0 left-0 w-[45vw] h-[50vh]"
          style={{ background: `radial-gradient(ellipse at bottom left, ${accent}18 0%, transparent 70%)` }}
        />
      </div>

      {/* Üst bar */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="h-4 w-4" />
          Ana Sayfa
        </Link>
        <div className="flex items-center gap-2">
          <LogoMark size={28} />
          <span className="font-bold text-white text-sm">{botName}</span>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pt-16 pb-10 text-center">
        <motion.div
          variants={fadeUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center"
        >
          {/* logo + glow */}
          <div className="relative mb-6">
            <div
              className="pointer-events-none"
              style={{
                position: "absolute", inset: 0, transform: "scale(2.2)",
                background: `radial-gradient(circle, ${accent}55 0%, transparent 65%)`,
                filter: "blur(35px)",
              }}
            />
            <div className="relative" style={{ filter: `drop-shadow(0 6px 22px ${accent}aa)` }}>
              {logo}
            </div>
          </div>

          <div
            className="inline-flex items-center gap-2 text-xs font-bold tracking-widest px-4 py-2 rounded-full mb-6"
            style={{ border: `1px solid ${accent}55`, background: `${accent}1a`, color: accent }}
          >
            <Clock className="h-3.5 w-3.5" />
            ÇOK YAKINDA
          </div>

          <h1 className="text-4xl md:text-5xl font-black mb-4 leading-tight">{botName}</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">{description}</p>
        </motion.div>
      </section>

      {/* Özellikler */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i + 0.2 }}
              className="rounded-2xl border p-5"
              style={{ borderColor: `${accent}26`, background: "rgba(10,10,18,0.6)" }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${accent}1f`, border: `1px solid ${accent}33` }}
              >
                <f.icon className="h-5 w-5" style={{ color: accent }} />
              </div>
              <p className="text-white font-semibold text-sm mb-1">{f.title}</p>
              <p className="text-slate-400 text-xs leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Bilgi + eBay'e geç */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border p-5"
          style={{ borderColor: `${accent}26`, background: `${accent}0d` }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: accent }} />
            <p className="text-slate-300 text-sm leading-relaxed">
              {botName} için ekibimiz aktif geliştirme yapıyor. Hazır olduğunda otomatik bilgilendirileceksin.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
            style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}
          >
            eBayBot&apos;u Kullan →
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
