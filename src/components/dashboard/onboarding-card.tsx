"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, ArrowRight, Rocket } from "lucide-react";

export interface OnboardingStatus {
  hasEbayAccount: boolean;
  hasProducts: boolean;
  autoUploadEnabled: boolean;
  hasOrders: boolean;
}

interface OnboardingCardProps {
  status?: OnboardingStatus;
}

interface Step {
  title: string;
  desc: string;
  done: boolean;
  href?: string;
  cta?: string;
}

export function OnboardingCard({ status }: OnboardingCardProps) {
  // Veri henüz gelmediyse gösterme (yanıp sönmeyi önler)
  if (!status) return null;

  const steps: Step[] = [
    {
      title: "eBay Mağazanı Bağla",
      desc: "Tek tıkla güvenli OAuth ile bağla. Her mağaza 7 gün ücretsiz başlar.",
      done: status.hasEbayAccount,
      href: "/dashboard/stores",
      cta: "Bağla",
    },
    {
      title: "Ürün Ekle",
      desc: "Chrome eklentisiyle Amazon'dan ASIN topla, panele yapıştır. Ya da Ürünler'den tek tek ekle.",
      done: status.hasProducts,
      href: "/dashboard/products",
      cta: "Ürün Ekle",
    },
    {
      title: "Otomatik Listele & Fiyatla",
      desc: "Oto-Yükleme'yi aç; sistem fiyatı pazara göre hesaplar, listeler, stok/fiyatı sürekli takip eder.",
      done: status.autoUploadEnabled,
      href: "/dashboard/auto-upload",
      cta: "Ayarla",
    },
    {
      title: "Sat & Kazan",
      desc: "Sipariş gelince canlı doğrulanır; sen kârına bakarsın, gerisini sistem yapar.",
      done: status.hasOrders,
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  // Tüm adımlar tamamlandıysa rehberi gizle
  if (completed === steps.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-br from-violet-600/10 to-blue-600/5 border border-violet-500/20 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-400 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Başlarken</h3>
            <p className="text-xs text-slate-400">4 adımda otomasyona geç</p>
          </div>
        </div>
        <span className="text-xs font-medium text-violet-300 bg-violet-500/10 px-3 py-1 rounded-full">
          {completed}/{steps.length} tamam
        </span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <div
            key={step.title}
            className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${
              step.done
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-slate-700/40 bg-slate-900/40"
            }`}
          >
            {/* Numara / tik */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                step.done
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-violet-500/15 text-violet-300"
              }`}
            >
              {step.done ? <Check className="h-4 w-4" /> : i + 1}
            </div>

            {/* Başlık + açıklama */}
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "text-slate-400 line-through" : "text-white"}`}>
                {step.title}
              </p>
              {!step.done && <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>}
            </div>

            {/* Aksiyon butonu (tamamlanmamış + linki olan adımlar) */}
            {!step.done && step.href && step.cta && (
              <Link
                href={step.href}
                className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors"
              >
                {step.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
