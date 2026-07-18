"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Store, Plug, Trash2, Loader2 } from "lucide-react";
import { PageHeader, InfoCard, Card, SHOPIFY_ACCENT } from "@/components/shopify/shared";

interface ShopifyAccountRow {
  id: string;
  shopDomain: string;
  accessState: "trial" | "active" | "frozen";
  trialDaysLeft: number;
  plan: string;
  productLimit: number;
  listingCount: number;
}

interface PlanRow {
  id: string;
  name: string;
  priceUsd: number;
  productLimit: number;
}

const ERROR_TEXT: Record<string, string> = {
  not_configured: "Shopify uygulaması henüz yapılandırılmadı — canlı desteğe yaz.",
  missing_params: "Bağlantı yarım kaldı, tekrar dene.",
  bad_hmac: "Shopify imzası doğrulanamadı — tekrar dene.",
  invalid_state: "Oturum doğrulaması geçersiz/süresi doldu — tekrar dene.",
  state_reused: "Bu bağlantı linki zaten kullanılmış — tekrar dene.",
  state_mismatch: "Giriş yaptığın hesap eşleşmedi — giriş yapıp tekrar dene.",
  shop_mismatch: "Mağaza adresi doğrulanamadı — tekrar dene.",
  shop_owned_by_other: "Bu mağaza başka bir kullanıcıya bağlı.",
  server_error: "Sunucu hatası — tekrar dene.",
};

// useSearchParams (hata/başarı query'leri) Next 15'te Suspense sınırı ister
export default function ShopifyStoresPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
      </div>
    }>
      <StoresContent />
    </Suspense>
  );
}

function StoresContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ShopifyAccountRow[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [shop, setShop] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/shopify/accounts");
    if (!res.ok) return;
    const j = await res.json();
    setAccounts(j.accounts);
    setConfigured(j.configured);
    setPlans(j.plans ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const errCode = searchParams.get("error");
  const connected = searchParams.get("connected");
  const billing = searchParams.get("billing");

  function connect() {
    if (!shop.trim()) return;
    setBusy(true);
    window.location.href = `/api/shopify/connect?shop=${encodeURIComponent(shop.trim())}`;
  }

  async function remove(id: string, domain: string) {
    if (!confirm(`${domain} bağlantısı kaldırılsın mı? Listelemeler takipten çıkar.`)) return;
    await fetch(`/api/shopify/accounts/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <>
      <PageHeader
        title="Mağazalar"
        subtitle="Shopify mağazanı bağla — her mağaza kendi paketiyle çalışır, bağlanınca 7 gün ücretsiz deneme başlar."
      />

      <div className="space-y-6 max-w-3xl">
        {errCode && (
          <InfoCard title="Bağlantı tamamlanamadı" text={ERROR_TEXT[errCode] ?? "Bilinmeyen hata — tekrar dene."} />
        )}
        {connected && (
          <InfoCard title="Mağaza bağlandı 🎉" text="7 günlük ücretsiz deneme başladı. Depodan ürün seçip yüklemeye başlayabilirsin." />
        )}
        {billing === "ok" && (
          <InfoCard title="Paket aktif 🎉" text="Aboneliğin Shopify üzerinden başladı — mağazan tam kapasite çalışıyor." />
        )}
        {billing && billing !== "ok" && (
          <InfoCard title="Paket satın alma tamamlanamadı" text="Onay tamamlanmadı veya doğrulanamadı — tekrar dene, olmazsa canlı desteğe yaz." />
        )}

        {/* Bağlama formu */}
        <Card pad="p-6">
          <p className="font-bold mb-1.5 flex items-center gap-2">
            <Plug className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> Yeni mağaza bağla
          </p>
          <p className="text-slate-400 text-xs mb-4 leading-relaxed">
            Mağazanın <span className="text-slate-300">myshopify.com</span> adresini yaz — Shopify izin
            ekranına yönlendirilirsin, onaylayınca bağlanır.
          </p>
          <div className="flex gap-2">
            <input
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connect()}
              placeholder="magazan.myshopify.com"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 outline-none focus:border-lime-500/50 text-white placeholder:text-slate-600"
            />
            <button
              onClick={connect}
              disabled={busy || !shop.trim() || !configured}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50"
              style={{ background: SHOPIFY_ACCENT }}
            >
              {busy ? "Yönlendiriliyor…" : "Bağla"}
            </button>
          </div>
          {!configured && (
            <p className="text-xs text-amber-400/80 mt-3">
              Shopify uygulaması sunucuda henüz yapılandırılmadı — bağlama açılınca burası otomatik çalışır.
            </p>
          )}
        </Card>

        {/* Hesap listesi */}
        {accounts === null ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Henüz bağlı mağaza yok.</p>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) => (
              <Card key={a.id} pad="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33` }}>
                      <Store className="h-5 w-5" style={{ color: SHOPIFY_ACCENT }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{a.shopDomain}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.listingCount} / {a.productLimit} ürün · {a.plan}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <AccessBadge state={a.accessState} trialDaysLeft={a.trialDaysLeft} />
                    <button
                      onClick={() => remove(a.id, a.shopDomain)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                      title="Bağlantıyı kaldır"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Paket seçimi — Shopify Billing açıkken görünür; ödeme Shopify
                    admin onayıyla alınır (deneme biten/donan mağazayı canlandırır) */}
                {plans.length > 0 && a.accessState !== "active" && (
                  <PlanPicker accountId={a.id} plans={plans} currentPlan={a.plan} />
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PlanPicker({ accountId, plans, currentPlan }: { accountId: string; plans: PlanRow[]; currentPlan: string }) {
  const [busyPlan, setBusyPlan] = useState("");
  const [err, setErr] = useState("");

  async function subscribe(planId: string) {
    setBusyPlan(planId); setErr("");
    try {
      const res = await fetch("/api/shopify/billing/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, plan: planId }),
      });
      const j = await res.json();
      if (!res.ok || !j.confirmationUrl) {
        setErr(j.error ?? "Başlatılamadı — tekrar dene");
        return;
      }
      window.location.href = j.confirmationUrl; // Shopify admin onay ekranı
    } catch {
      setErr("Bağlantı hatası — tekrar dene");
    } finally {
      setBusyPlan("");
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <p className="text-xs text-slate-400 mb-2.5">
        Paket seç — ödeme güvenle <span className="text-slate-300">Shopify üzerinden</span> alınır:
      </p>
      <div className="flex flex-wrap gap-2">
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => subscribe(p.id)}
            disabled={Boolean(busyPlan)}
            className="text-xs font-bold rounded-lg px-3.5 py-2 text-white bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-colors"
            style={p.id === currentPlan ? { borderColor: `${SHOPIFY_ACCENT}66` } : undefined}
          >
            {busyPlan === p.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
              : <>{p.name} · ${p.priceUsd}/ay · {p.productLimit} ürün</>}
          </button>
        ))}
      </div>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </div>
  );
}

function AccessBadge({ state, trialDaysLeft }: { state: string; trialDaysLeft: number }) {
  const map: Record<string, { c: string; t: string }> = {
    trial: { c: "#3b82f6", t: `Deneme · ${trialDaysLeft}g` },
    active: { c: "#22c55e", t: "Aktif" },
    frozen: { c: "#f59e0b", t: "Donduruldu" },
  };
  const m = map[state] ?? { c: "#94a3b8", t: state };
  return (
    <span className="text-[10px] font-bold rounded-full px-2.5 py-1"
      style={{ color: m.c, border: `1px solid ${m.c}55`, background: `${m.c}14` }}>
      {m.t}
    </span>
  );
}
