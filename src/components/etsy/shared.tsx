"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { EtsyOverview } from "@/types/etsyflow";

// etsyflow-project'in kendi marka rengi (tailwind.config.js brand-400/brand-500)
export const ETSY_ACCENT = "#d4a054";
export const ETSY_ACCENT2 = "#c08430";

// ─── Veri katmanı (tek fetch, tüm sayfalar paylaşır) ────────────────────────

export type EtsyState =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EtsyOverview };

interface EtsyCtxValue {
  state: EtsyState;
  reload: () => void;
  email: string | null;
}

const EtsyCtx = createContext<EtsyCtxValue | null>(null);

export function useEtsyData(): EtsyCtxValue {
  const ctx = useContext(EtsyCtx);
  if (!ctx) throw new Error("useEtsyData must be used within EtsyDataProvider");
  return ctx;
}

export function EtsyDataProvider({ email, children }: { email: string | null; children: ReactNode }) {
  const [state, setState] = useState<EtsyState>({ kind: "loading" });

  const reload = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/etsy/overview");
      if (res.status === 503) return setState({ kind: "not-configured" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return setState({ kind: "error", message: j.error ?? `Hata (${res.status})` });
      }
      const data: EtsyOverview = await res.json();
      setState({ kind: "ready", data });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Bağlantı hatası" });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return <EtsyCtx.Provider value={{ state, reload, email }}>{children}</EtsyCtx.Provider>;
}

/** Veri hazır olana kadar durum ekranlarını gösterir; hazırsa render prop'u çağırır. */
export function EtsyReady({ children }: { children: (data: EtsyOverview) => ReactNode }) {
  const { state } = useEtsyData();

  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-24 justify-center">
        <Loader2 className="h-6 w-6 animate-spin" /> Yükleniyor...
      </div>
    );
  }
  if (state.kind === "not-configured") {
    return (
      <InfoCard
        title="EtsyFlow bağlantısı kurulmadı"
        text="Sunucuda ETSYFLOW_SUPABASE_SERVICE_KEY tanımlanmalı. Anahtar girilince panel otomatik çalışır."
      />
    );
  }
  if (state.kind === "error") {
    return <InfoCard title="Bir hata oluştu" text={state.message} />;
  }
  return <>{children(state.data)}</>;
}

// ─── Ortak UI ───────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { reload, email } = useEtsyData();
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
        {email && (
          <p className="text-xs text-slate-500 mt-2">
            Bağlı hesap: <span className="text-slate-300 font-medium">{email}</span>
          </p>
        )}
      </div>
      <button
        onClick={reload}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors flex-shrink-0"
      >
        <RefreshCw className="h-4 w-4" /> Yenile
      </button>
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
        style={{ background: `radial-gradient(circle, ${ETSY_ACCENT}26 0%, transparent 70%)`, filter: "blur(20px)" }}
      />
      <div className="relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${ETSY_ACCENT}1f`, border: `1px solid ${ETSY_ACCENT}33` }}
        >
          <Icon className="h-5 w-5" style={{ color: ETSY_ACCENT }} />
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
      className={`rounded-xl ${pad} transition-colors bg-[#111827] border border-[#1e293b] hover:border-[#334155]`}
    >
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="text-[#64748b] text-sm py-10 text-center rounded-xl bg-[#0c1322] border border-[#1e293b]">
      {text}
    </p>
  );
}

export function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-6 max-w-xl" style={{ borderColor: `${ETSY_ACCENT}33`, background: `${ETSY_ACCENT}0d` }}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ETSY_ACCENT }} />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "#22c55e", new: "#3b82f6", pending: "#f59e0b", draft: "#94a3b8",
    error: "#ef4444", preparing: "#f59e0b", shipped: "#8b5cf6", delivered: "#22c55e",
    cancelled: "#ef4444", inactive: "#94a3b8", paused: "#f59e0b",
  };
  const c = map[status] ?? "#94a3b8";
  return (
    <span
      className="text-[10px] font-medium rounded-full px-2 py-0.5 capitalize flex-shrink-0"
      style={{ color: c, border: `1px solid ${c}55`, background: `${c}14` }}
    >
      {status}
    </span>
  );
}
