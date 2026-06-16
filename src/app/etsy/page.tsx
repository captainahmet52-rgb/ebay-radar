"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft, Store, Package, ShoppingCart, ExternalLink,
  AlertCircle, Loader2, RefreshCw,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import type { EtsyOverview } from "@/types/etsyflow";

const ACCENT = "#f97316";
const ETSYFLOW_URL = process.env.NEXT_PUBLIC_ETSYFLOW_URL ?? "https://etsyflow-project.vercel.app";

type State =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "not-linked" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EtsyOverview };

export default function EtsyBotPage() {
  const { status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  async function load() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/etsy/overview");
      if (res.status === 503) return setState({ kind: "not-configured" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return setState({ kind: "error", message: j.error ?? `Hata (${res.status})` });
      }
      const data: EtsyOverview = await res.json();
      setState(data.linked ? { kind: "ready", data } : { kind: "not-linked" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Bağlantı hatası" });
    }
  }

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#050508" }}>
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#050508" }}>
      {/* Arka plan parlaması */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-20 right-0 w-[55vw] h-[60vh]"
          style={{ background: `radial-gradient(ellipse at top right, ${ACCENT}22 0%, transparent 70%)` }} />
      </div>

      {/* Üst bar */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-10 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Ana Sayfa
        </Link>
        <div className="flex items-center gap-2">
          <LogoMark size={26} />
          <span className="font-bold text-sm">EtsyBot</span>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors">
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black mb-1">EtsyBot Paneli</h1>
        <p className="text-slate-400 text-sm mb-8">
          Etsy otomasyonun EtsyFlow&apos;da çalışır; burada mağaza, ürün ve siparişlerini görürsün.
        </p>

        {state.kind === "loading" && (
          <div className="flex items-center gap-3 text-slate-400 py-20 justify-center">
            <Loader2 className="h-6 w-6 animate-spin" /> Yükleniyor...
          </div>
        )}

        {state.kind === "not-configured" && (
          <InfoCard
            title="EtsyFlow bağlantısı henüz kurulmadı"
            text="Yönetici .env dosyasına ETSYFLOW_SUPABASE_SERVICE_KEY eklemeli. Anahtar girilince bu panel otomatik çalışır."
          />
        )}

        {state.kind === "not-linked" && (
          <InfoCard
            title="EtsyFlow hesabın bu e-posta ile bulunamadı"
            text="EtsyFlow'da bu hesapla aynı e-postayı kullanırsan mağazaların burada otomatik görünür."
            action={{ label: "EtsyFlow'u Aç", href: ETSYFLOW_URL }}
          />
        )}

        {state.kind === "error" && (
          <InfoCard title="Bir hata oluştu" text={state.message} />
        )}

        {state.kind === "ready" && <Overview data={state.data} />}
      </main>
    </div>
  );
}

function Overview({ data }: { data: EtsyOverview }) {
  const activeProducts = data.products.filter((p) => p.status === "active").length;
  const newOrders = data.orders.filter((o) => o.status === "new").length;

  return (
    <div className="space-y-8">
      {/* İstatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Store} label="Mağaza" value={data.stores.length} />
        <Stat icon={Package} label="Ürün" value={data.products.length} sub={`${activeProducts} aktif`} />
        <Stat icon={ShoppingCart} label="Sipariş" value={data.orders.length} sub={`${newOrders} yeni`} />
        <Stat icon={Store} label="Aktif Mağaza" value={data.stores.filter((s) => s.status === "active").length} />
      </div>

      {/* Mağazalar */}
      <Section title="Mağazalar">
        {data.stores.length === 0 ? (
          <Empty text="Henüz mağaza yok." />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.stores.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <p className="font-semibold text-sm">{s.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {s.category ?? "—"} · {s.currency} · {s.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Son ürünler */}
      <Section title="Son Ürünler">
        {data.products.length === 0 ? (
          <Empty text="Henüz ürün yok." />
        ) : (
          <div className="space-y-2">
            {data.products.slice(0, 10).map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                {p.images?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Package className="h-4 w-4 text-slate-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{p.title}</p>
                  <p className="text-xs text-slate-500">{p.status}</p>
                </div>
                {p.etsy_listing_id && (
                  <span className="text-[10px] text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5">
                    Etsy&apos;de
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* EtsyFlow'da yönet */}
      <a
        href={ETSYFLOW_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
        style={{ background: `linear-gradient(135deg,${ACCENT},#ea580c)` }}
      >
        EtsyFlow&apos;da Detaylı Yönet <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
        style={{ background: `${ACCENT}1f`, border: `1px solid ${ACCENT}33` }}>
        <Icon className="h-4 w-4" style={{ color: ACCENT }} />
      </div>
      <p className="text-2xl font-black">{value}</p>
      <p className="text-xs text-slate-400">{label}{sub ? ` · ${sub}` : ""}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-slate-500 text-sm py-6 text-center rounded-xl border border-white/8 bg-white/[0.015]">{text}</p>;
}

function InfoCard({ title, text, action }: { title: string; text: string; action?: { label: string; href: string } }) {
  return (
    <div className="rounded-2xl border p-6 max-w-xl" style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}0d` }}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
          {action && (
            <a href={action.href} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: `linear-gradient(135deg,${ACCENT},#ea580c)` }}>
              {action.label} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
