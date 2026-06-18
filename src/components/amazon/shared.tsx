"use client";

import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import type { AmazonCandidate, RadarVerdict } from "@/lib/amazon-radar";

export const AMZ_ACCENT = "#10b981";   // emerald
export const AMZ_ACCENT2 = "#059669";  // koyu yeşil

export interface RadarResult {
  candidate: AmazonCandidate;
  verdict: RadarVerdict;
}
export interface RadarResponse {
  market: string;
  demo: boolean;
  total: number;
  passed: number;
  results: RadarResult[];
}

export const AMZ_MARKET_LABELS: Record<string, string> = {
  us: "ABD", uk: "İngiltere", ae: "BAE", sa: "Suudi",
};

// ─── Veri katmanı ─────────────────────────────────────────────────────────────

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: RadarResponse };

interface Ctx {
  state: State;
  market: string;
  setMarket: (m: string) => void;
  reload: () => void;
}

const AmzCtx = createContext<Ctx | null>(null);

export function useAmazonData(): Ctx {
  const c = useContext(AmzCtx);
  if (!c) throw new Error("useAmazonData must be used within AmazonDataProvider");
  return c;
}

export function AmazonDataProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState("us");
  const [state, setState] = useState<State>({ kind: "loading" });

  const reload = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/amazon/radar?market=${market}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return setState({ kind: "error", message: j.error ?? `Hata (${res.status})` });
      }
      const data: RadarResponse = await res.json();
      setState({ kind: "ready", data });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Bağlantı hatası" });
    }
  }, [market]);

  useEffect(() => { void reload(); }, [reload]);

  return <AmzCtx.Provider value={{ state, market, setMarket, reload }}>{children}</AmzCtx.Provider>;
}

export function AmazonReady({ children }: { children: (data: RadarResponse) => ReactNode }) {
  const { state } = useAmazonData();
  if (state.kind === "loading") {
    return (
      <div className="flex items-center gap-3 text-slate-400 py-24 justify-center">
        <Loader2 className="h-6 w-6 animate-spin" /> Radar çalışıyor...
      </div>
    );
  }
  if (state.kind === "error") return <InfoCard title="Hata" text={state.message} />;
  return <>{children(state.data)}</>;
}

// ─── Ortak UI ─────────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { reload, market, setMarket, state } = useAmazonData();
  const demo = state.kind === "ready" && state.data.demo;
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">{title}</h1>
          {subtitle && <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
        </div>
        <button onClick={reload} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors flex-shrink-0">
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {Object.entries(AMZ_MARKET_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMarket(key)}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={market === key
              ? { background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}55`, color: AMZ_ACCENT }
              : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#94a3b8" }}
          >
            {label}
          </button>
        ))}
        {demo && (
          <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded-full px-2 py-1 ml-1">
            DEMO VERİ — kaynak bağlanınca canlı
          </span>
        )}
      </div>
    </div>
  );
}

export function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string | number; sub?: string }) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden"
      style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="absolute -top-8 -right-8 w-24 h-24 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${AMZ_ACCENT}26 0%, transparent 70%)`, filter: "blur(20px)" }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}33` }}>
          <Icon className="h-5 w-5" style={{ color: AMZ_ACCENT }} />
        </div>
        <p className="text-3xl font-black leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1.5">{label}{sub ? <span className="text-slate-500"> · {sub}</span> : null}</p>
      </div>
    </div>
  );
}

export function Card({ children, pad = "p-4" }: { children: ReactNode; pad?: string }) {
  return (
    <div className={`rounded-xl ${pad} transition-colors hover:border-emerald-500/25`}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="text-slate-500 text-sm py-10 text-center rounded-xl"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>{text}</p>
  );
}

export function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-6 max-w-xl" style={{ borderColor: `${AMZ_ACCENT}33`, background: `${AMZ_ACCENT}0d` }}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
