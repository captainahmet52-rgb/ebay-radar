"use client";

// ShopifyBot ortak UI parçaları — etsy/shared.tsx ile aynı desen.
// Veri katmanı YOK (backend henüz kurulmadı): sayfalar şimdilik iskelet/boş durum
// gösterir; API'ler geldikçe buraya Etsy'deki gibi bir DataProvider eklenecek.

import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export const SHOPIFY_ACCENT = "#96bf48";
export const SHOPIFY_ACCENT2 = "#7ca93c";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl md:text-3xl font-black">{title}</h1>
      {subtitle && (
        <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

export function Stat({
  icon: Icon, label, value, sub,
}: { icon: React.ElementType; label: string; value: number; sub?: string }) {
  return (
    <div
      className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div
        className="absolute -top-8 -right-8 w-24 h-24 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${SHOPIFY_ACCENT}26 0%, transparent 70%)`, filter: "blur(20px)" }}
      />
      <div className="relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${SHOPIFY_ACCENT}1f`, border: `1px solid ${SHOPIFY_ACCENT}33` }}
        >
          <Icon className="h-5 w-5" style={{ color: SHOPIFY_ACCENT }} />
        </div>
        <p className="text-3xl font-black leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1.5">
          {label}{sub ? <span className="text-slate-500"> · {sub}</span> : null}
        </p>
      </div>
    </div>
  );
}

export function Card({ children, pad = "p-4" }: { children: ReactNode; pad?: string }) {
  return (
    <div
      className={`rounded-xl ${pad} transition-colors hover:border-lime-500/25`}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p
      className="text-slate-500 text-sm py-10 text-center rounded-xl"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {text}
    </p>
  );
}

export function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div
      className="rounded-2xl border p-6 max-w-xl"
      style={{ borderColor: `${SHOPIFY_ACCENT}33`, background: `${SHOPIFY_ACCENT}0d` }}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: SHOPIFY_ACCENT }} />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
