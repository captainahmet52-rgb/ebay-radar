"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Store, Trash2, Plus, Power, Crown, Clock, Snowflake } from "lucide-react";
import { PageHeader, Card, Empty, AMZ_ACCENT } from "@/components/amazon/shared";
import { storeAccessState, trialDaysLeft, STORE_TRIAL_PRODUCT_LIMIT } from "@/lib/store-access";

interface AmazonAccount {
  id: string;
  sellerId: string;
  market: string;
  createdAt: string;
  isActive: boolean;
  trialEndsAt: string | null;
  paidUntil: string | null;
  plan: string;
  productLimit: number;
  _count: { listings: number };
}

const MARKET_LABELS: Record<string, string> = {
  us: "🇺🇸 Amazon US",
  uk: "🇬🇧 Amazon UK",
  ae: "🇦🇪 Amazon BAE",
  sa: "🇸🇦 Amazon Suudi",
};

function stateOf(a: AmazonAccount) {
  return storeAccessState({
    trialEndsAt: a.trialEndsAt ? new Date(a.trialEndsAt) : null,
    paidUntil: a.paidUntil ? new Date(a.paidUntil) : null,
  });
}

export default function AmazonStoresPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AmazonAccount[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/amazon/accounts");
    if (r.ok) setAccounts((await r.json()).data);
    else setMsg("Hesaplar yüklenemedi");
  }
  useEffect(() => { void load(); }, []);

  // PAKET = HESAP: her Amazon hesabı kendi aboneliğini alır. "Paket Al" → o hesap
  // bağlamıyla (?account=) paketler sayfasına gider; ödeme gelince webhook aktive eder.
  function goToCheckout(id: string) {
    router.push(`/amazon/pricing?account=${id}`);
  }

  async function deactivate(id: string) {
    if (!confirm("Bu hesabı pasifleştirmek istediğine emin misin? Oto-yükleme durur.")) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/amazon/accounts/${id}/activate`, { method: "DELETE" });
      if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error ?? "Pasifleştirme başarısız."); return; }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm("Bu Amazon mağazasının bağlantısını kesmek istiyor musun? Listelemeleri de silinir.")) return;
    setBusyId(id);
    try {
      const r = await fetch(`/api/amazon/accounts/${id}`, { method: "DELETE" });
      if (r.ok) { setMsg("Mağaza bağlantısı kesildi."); await load(); }
      else setMsg((await r.json()).error ?? "Hata");
    } finally {
      setBusyId(null);
    }
  }

  const counts = (accounts ?? []).reduce(
    (acc, a) => { acc[stateOf(a)]++; return acc; },
    { active: 0, trial: 0, frozen: 0 } as Record<"active" | "trial" | "frozen", number>
  );

  return (
    <>
      <PageHeader title="Mağazalarım" subtitle="Amazon satıcı hesaplarını bağla. Pazar (US/UK/BAE/Suudi) bağlanırken otomatik tespit edilir." />

      {/* Bağlama */}
      <Card pad="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300 flex items-center gap-2">
            <Plus className="h-4 w-4" style={{ color: AMZ_ACCENT }} /> Yeni mağaza bağla:
          </span>
          <a
            href="/api/amazon/connect?region=na"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-black"
            style={{ background: AMZ_ACCENT }}
          >
            🇺🇸 Amazon US
          </a>
          <a
            href="/api/amazon/connect?region=eu"
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-white/10 text-white hover:border-emerald-500/40"
          >
            🇬🇧🇦🇪🇸🇦 Amazon UK / BAE / Suudi
          </a>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          SP-API anahtarları bağlanınca yetkilendirme açılır. Hangi anahtar gerekli →{" "}
          <span style={{ color: AMZ_ACCENT }}>Admin → API Kurulumu</span>
        </p>
      </Card>

      {/* Durum özeti */}
      {accounts && accounts.length > 0 && (
        <Card pad="p-4">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Aktif: {counts.active}
              </span>
              <span className="flex items-center gap-1.5 text-blue-400">
                <Clock className="h-3.5 w-3.5" /> Deneme: {counts.trial}
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <Snowflake className="h-3.5 w-3.5" /> Donduruldu: {counts.frozen}
              </span>
            </div>
            <Link href="/amazon/pricing" className="text-xs hover:underline flex items-center gap-1" style={{ color: AMZ_ACCENT }}>
              <Crown className="h-3.5 w-3.5" /> Paketler
            </Link>
          </div>
        </Card>
      )}

      {msg && <p className="text-sm text-slate-300 my-3">{msg}</p>}

      {/* Bağlı mağazalar */}
      <h2 className="text-lg font-bold mt-6 mb-3">Bağlı mağazalar</h2>
      {!accounts ? (
        <div className="flex items-center gap-3 text-slate-400 py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...
        </div>
      ) : accounts.length === 0 ? (
        <Empty text="Henüz bağlı Amazon mağazan yok. Yukarıdan bir mağaza bağla." />
      ) : (
        <div className="space-y-2.5">
          {accounts.map((a, i) => {
            const state = stateOf(a);
            const daysLeft = trialDaysLeft(a.trialEndsAt ? new Date(a.trialEndsAt) : null);
            return (
              <motion.div key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }} whileHover={{ x: 3 }}>
              <Card pad="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}33` }}>
                      <Store className="h-5 w-5" style={{ color: AMZ_ACCENT }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{MARKET_LABELS[a.market] ?? a.market}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Satıcı: {a.sellerId} · {a._count.listings}/{a.productLimit} listeleme
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {state === "active" ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Aktif
                      </span>
                    ) : state === "trial" ? (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Deneme — {daysLeft} gün
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-500/15 text-red-400 flex items-center gap-1">
                        <Snowflake className="h-3 w-3" /> Donduruldu
                      </span>
                    )}

                    {state === "frozen" ? (
                      <button onClick={() => goToCheckout(a.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-black flex items-center gap-1"
                        style={{ background: AMZ_ACCENT }}>
                        <Crown className="h-3.5 w-3.5" /> Paket Al
                      </button>
                    ) : (
                      <button onClick={() => deactivate(a.id)} disabled={busyId === a.id}
                        className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                        title="Pasifleştir">
                        <Power className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => disconnect(a.id)} disabled={busyId === a.id}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Bağlantıyı kes">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {state === "trial" && (
                  <p className="text-xs mt-2" style={{ color: `${AMZ_ACCENT}cc` }}>
                    Ücretsiz deneme: bu hesaba {STORE_TRIAL_PRODUCT_LIMIT} ürün yükleyebilirsin.
                  </p>
                )}
                {state === "frozen" && (
                  <p className="text-xs text-red-300/80 mt-2">
                    Ücretsiz sürüm bitti. Oto-yükleme durdu — devam etmek için paket satın al.
                  </p>
                )}
              </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}
