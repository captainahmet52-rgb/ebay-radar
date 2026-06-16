"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Store, Package, ShoppingCart, ExternalLink, Sparkles,
  AlertCircle, Loader2, RefreshCw, CheckCircle2, TrendingUp,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import type { EtsyOverview } from "@/types/etsyflow";

const ACCENT = "#f97316";
const ACCENT2 = "#ea580c";
const ETSYFLOW_URL = process.env.NEXT_PUBLIC_ETSYFLOW_URL ?? "https://etsyflow-project.vercel.app";

type State =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: EtsyOverview };

export default function EtsyBotPage() {
  const { status, data: session } = useSession();
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
      setState({ kind: "ready", data });
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
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 right-0 w-[60vw] h-[70vh]"
          style={{ background: `radial-gradient(ellipse at top right, ${ACCENT}26 0%, transparent 65%)` }} />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[45vh]"
          style={{ background: `radial-gradient(ellipse at bottom left, ${ACCENT}14 0%, transparent 70%)` }} />
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

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Başlık */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest px-3 py-1.5 rounded-full mb-4"
            style={{ border: `1px solid ${ACCENT}40`, background: `${ACCENT}14`, color: ACCENT }}>
            <Sparkles className="h-3.5 w-3.5" /> ETSY OTOMASYONU
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2">EtsyBot Paneli</h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            Etsy otomasyonun EtsyFlow&apos;da çalışır; mağaza, ürün ve siparişlerini buradan tek bakışta izlersin.
          </p>
          {session?.user?.email && (
            <p className="text-xs text-slate-500 mt-3">
              Bağlı hesap: <span className="text-slate-300 font-medium">{session.user.email}</span>
            </p>
          )}
        </motion.div>

        {state.kind === "loading" && (
          <div className="flex items-center gap-3 text-slate-400 py-24 justify-center">
            <Loader2 className="h-6 w-6 animate-spin" /> Yükleniyor...
          </div>
        )}

        {state.kind === "not-configured" && (
          <InfoCard
            title="EtsyFlow bağlantısı henüz kurulmadı"
            text="Sunucuda ETSYFLOW_SUPABASE_SERVICE_KEY tanımlanmalı. Anahtar girilince bu panel otomatik çalışır."
          />
        )}

        {state.kind === "error" && <InfoCard title="Bir hata oluştu" text={state.message} />}

        {state.kind === "ready" && <Overview data={state.data} email={session?.user?.email ?? null} />}
      </main>
    </div>
  );
}

function Overview({ data, email }: { data: EtsyOverview; email: string | null }) {
  const activeProducts = data.products.filter((p) => p.status === "active").length;
  const newOrders = data.orders.filter((o) => o.status === "new").length;
  const activeStores = data.stores.filter((s) => s.status === "active").length;
  const isEmpty = data.stores.length === 0 && data.products.length === 0;

  return (
    <div className="space-y-8">
      {/* İstatistikler */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Stat icon={Store} label="Mağaza" value={data.stores.length} sub={`${activeStores} aktif`} />
        <Stat icon={Package} label="Ürün" value={data.products.length} sub={`${activeProducts} aktif`} />
        <Stat icon={ShoppingCart} label="Sipariş" value={data.orders.length} sub={`${newOrders} yeni`} />
        <Stat icon={TrendingUp} label="Aktif Listeleme" value={data.products.filter((p) => p.etsy_listing_id).length} />
      </motion.div>

      {isEmpty ? (
        <Onboarding email={email} />
      ) : (
        <>
          {/* Mağazalar */}
          <Section title="Mağazalar" count={data.stores.length}>
            {data.stores.length === 0 ? (
              <Empty text="Henüz mağaza yok." />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.stores.map((s) => (
                  <Card key={s.id}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${ACCENT}1a`, border: `1px solid ${ACCENT}33` }}>
                        <Store className="h-5 w-5" style={{ color: ACCENT }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{s.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {s.category ?? "—"} · {s.currency}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>

          {/* Son ürünler */}
          <Section title="Son Ürünler" count={data.products.length}>
            {data.products.length === 0 ? (
              <Empty text="Henüz ürün yok." />
            ) : (
              <div className="space-y-2">
                {data.products.slice(0, 12).map((p) => (
                  <Card key={p.id} pad="p-3">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <Package className="h-4 w-4 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{p.title}</p>
                        <p className="text-xs text-slate-500 capitalize">{p.status}</p>
                      </div>
                      {p.etsy_listing_id && (
                        <span className="text-[10px] font-medium text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 flex-shrink-0">
                          Etsy&apos;de
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Section>
        </>
      )}

      {/* EtsyFlow'da yönet */}
      <a href={ETSYFLOW_URL} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01]"
        style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 10px 28px ${ACCENT}44` }}>
        EtsyFlow&apos;da Detaylı Yönet <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

function Onboarding({ email }: { email: string | null }) {
  const steps = [
    { n: "1", t: "Mağazanı bağla", d: `EtsyFlow'da ${email ? `"${email}"` : "bu e-posta"} ile giriş yap ve Etsy mağazanı oluştur.` },
    { n: "2", t: "Ürünleri ekle", d: "Ürünlerini ekle veya AI ile başlık/görsel üret, kategorilere ayır." },
    { n: "3", t: "Otomatik takip", d: "Mağaza, ürün ve siparişlerin burada otomatik görünür ve izlenir." },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="relative rounded-3xl overflow-hidden p-8 md:p-10"
      style={{
        background: "linear-gradient(180deg, rgba(20,14,10,0.7) 0%, rgba(8,6,10,0.85) 100%)",
        border: `1px solid ${ACCENT}26`,
        boxShadow: `0 0 60px ${ACCENT}12, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="absolute -top-16 -right-10 w-64 h-64 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT}33 0%, transparent 70%)`, filter: "blur(40px)" }} />

      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${ACCENT}1a`, border: `1px solid ${ACCENT}40` }}>
          <Store className="h-7 w-7" style={{ color: ACCENT }} />
        </div>
        <h2 className="text-2xl font-black mb-2">Etsy mağazanı bağlayarak başla</h2>
        <p className="text-slate-400 max-w-xl leading-relaxed mb-8">
          Bu hesapta henüz Etsy verisi yok. EtsyFlow&apos;da mağazanı oluşturunca ürünlerin,
          siparişlerin ve otomasyonun burada otomatik görünecek.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})` }}>
                {s.n}
              </div>
              <div>
                <p className="font-semibold text-sm mb-1">{s.t}</p>
                <p className="text-slate-400 text-xs leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a href={ETSYFLOW_URL} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 hover:scale-[1.01]"
            style={{ background: `linear-gradient(135deg,${ACCENT},${ACCENT2})`, boxShadow: `0 10px 28px ${ACCENT}44` }}>
            EtsyFlow&apos;da Başla <ExternalLink className="h-4 w-4" />
          </a>
          {email && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              Aynı e-posta ile giriş yaparsan veriler otomatik eşleşir.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: number; sub?: string }) {
  return (
    <div className="relative rounded-2xl p-5 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}>
      <div className="absolute -top-8 -right-8 w-24 h-24 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${ACCENT}26 0%, transparent 70%)`, filter: "blur(20px)" }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: `${ACCENT}1f`, border: `1px solid ${ACCENT}33` }}>
          <Icon className="h-5 w-5" style={{ color: ACCENT }} />
        </div>
        <p className="text-3xl font-black leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1.5">
          {label}{sub ? <span className="text-slate-500"> · {sub}</span> : null}
        </p>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {typeof count === "number" && (
          <span className="text-xs text-slate-500 bg-white/5 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function Card({ children, pad = "p-4" }: { children: React.ReactNode; pad?: string }) {
  return (
    <div className={`rounded-xl ${pad} transition-colors hover:border-orange-500/25`}
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-slate-500 text-sm py-8 text-center rounded-xl"
      style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
      {text}
    </p>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border p-6 max-w-xl" style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}0d` }}>
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: ACCENT }} />
        <div>
          <p className="font-semibold mb-1">{title}</p>
          <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
