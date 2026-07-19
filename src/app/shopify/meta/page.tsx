"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Copy, Check, Megaphone, Plug, Play, Pause } from "lucide-react";
import { PageHeader, InfoCard, Card, StatusBadge, SHOPIFY_ACCENT } from "@/components/shopify/shared";

interface AccountRow {
  id: string;
  shopDomain: string;
  metaPixelId: string | null;
  feedToken: string;
  accessState: string;
  metaConnected: boolean;
  metaBusinessName: string | null;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  dailyBudgetUsd: number;
  headline: string | null;
  spendUsd: number;
  impressions: number;
  clicks: number;
  lastSyncAt: string | null;
  lastError: string | null;
  metaAccount: { adAccountId: string; businessName: string | null };
  listing: { product: { title: string | null; imageUrl: string | null } };
}

const ERROR_TEXT: Record<string, string> = {
  not_configured: "Meta uygulaması henüz yapılandırılmadı — canlı desteğe yaz.",
  missing_params: "Bağlantı yarım kaldı, tekrar dene.",
  invalid_state: "Oturum doğrulaması geçersiz/süresi doldu — tekrar dene.",
  state_reused: "Bu bağlantı linki zaten kullanılmış — tekrar dene.",
  state_mismatch: "Giriş yaptığın hesap eşleşmedi — giriş yapıp tekrar dene.",
  not_found: "Mağaza bulunamadı.",
  no_ad_account: "Meta hesabında erişilebilir reklam hesabı bulunamadı.",
  server_error: "Sunucu hatası — tekrar dene.",
};

// useSearchParams (error/connected) Next 15'te Suspense sınırı ister
export default function ShopifyMetaPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...</div>}>
      <MetaContent />
    </Suspense>
  );
}

function MetaContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [metaConfigured, setMetaConfigured] = useState(true);

  const load = useCallback(async () => {
    const [accRes, campRes] = await Promise.all([
      fetch("/api/shopify/accounts"),
      fetch("/api/shopify/meta/campaigns"),
    ]);
    if (accRes.ok) {
      const j = await accRes.json();
      setAccounts(j.accounts);
      setMetaConfigured(j.metaConfigured);
    }
    if (campRes.ok) {
      const j = await campRes.json();
      setCampaigns(j.campaigns ?? []);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const errCode = searchParams.get("error");
  const connected = searchParams.get("connected");

  return (
    <>
      <PageHeader
        title="Meta Reklamları"
        subtitle="Meta Business hesabını bağla — AI kampanya taslaklarını doğrudan Facebook/Instagram'da gerçek kampanyaya çevir."
      />

      <div className="space-y-6 max-w-3xl">
        {errCode && <InfoCard title="Bağlantı tamamlanamadı" text={ERROR_TEXT[errCode] ?? "Bilinmeyen hata — tekrar dene."} />}
        {connected && <InfoCard title="Meta bağlandı 🎉" text="Artık ürünlerin sayfasından tek tıkla gerçek Meta kampanyası oluşturabilirsin." />}

        {accounts === null ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">Önce Mağazalar sayfasından bir Shopify mağazası bağla.</p>
        ) : (
          accounts.map((a) => <AccountMetaCard key={a.id} account={a} metaConfigured={metaConfigured} />)
        )}

        {campaigns.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-300 pt-2">Kampanyalarım</p>
            {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} onChange={load} />)}
          </div>
        )}
      </div>
    </>
  );
}

function AccountMetaCard({ account, metaConfigured }: { account: AccountRow; metaConfigured: boolean }) {
  const [pixel, setPixel] = useState(account.metaPixelId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const feedUrl = typeof window !== "undefined" ? `${window.location.origin}/api/shopify/meta-feed/${account.feedToken}` : "";

  async function savePixel() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const res = await fetch(`/api/shopify/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaPixelId: pixel.trim() || null }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error ?? "Kaydedilemedi"); }
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } finally {
      setSaving(false);
    }
  }

  async function copyFeed() {
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card pad="p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold flex items-center gap-2">
          <Megaphone className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> {account.shopDomain}
        </p>
        {account.metaConnected ? (
          <span className="text-[11px] font-bold rounded-full px-2.5 py-1" style={{ color: SHOPIFY_ACCENT, border: `1px solid ${SHOPIFY_ACCENT}55`, background: `${SHOPIFY_ACCENT}14` }}>
            ✓ Bağlı{account.metaBusinessName ? ` · ${account.metaBusinessName}` : ""}
          </span>
        ) : (
          <a
            href={`/api/shopify/meta/connect?accountId=${account.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3.5 py-2 text-black"
            style={{ background: metaConfigured ? SHOPIFY_ACCENT : "#475569", pointerEvents: metaConfigured ? "auto" : "none" }}
          >
            <Plug className="h-3.5 w-3.5" /> Meta&apos;yı Bağla
          </a>
        )}
      </div>
      {!metaConfigured && !account.metaConnected && (
        <p className="text-xs text-amber-400/80 mb-4">Meta uygulaması sunucuda henüz yapılandırılmadı.</p>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-400 mb-1.5">Katalog besleme adresi (Meta Commerce Manager&apos;a yapıştır)</p>
          <div className="flex gap-2">
            <code className="flex-1 text-[11px] rounded-lg px-3 py-2.5 bg-black/40 border border-white/10 text-slate-300 truncate">{feedUrl}</code>
            <button onClick={copyFeed} className="px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors" title="Kopyala">
              {copied ? <Check className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 mb-1.5">Meta Pixel ID (opsiyonel — dönüşüm takibi için)</p>
          <div className="flex gap-2">
            <input
              value={pixel}
              onChange={(e) => setPixel(e.target.value)}
              placeholder="ör. 1234567890123456"
              className="flex-1 rounded-lg px-3 py-2.5 text-sm bg-white/5 border border-white/10 outline-none focus:border-lime-500/50 text-white placeholder:text-slate-600"
            />
            <button onClick={savePixel} disabled={saving} className="px-4 rounded-lg text-sm font-bold text-black disabled:opacity-50" style={{ background: SHOPIFY_ACCENT }}>
              {saving ? "…" : saved ? "✓" : "Kaydet"}
            </button>
          </div>
          {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
        </div>
      </div>
    </Card>
  );
}

function CampaignCard({ campaign, onChange }: { campaign: CampaignRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setBusy(true);
    try {
      await fetch(`/api/shopify/meta/campaigns/${campaign.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card pad="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
          {campaign.listing.product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={campaign.listing.product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{campaign.headline ?? campaign.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            ${campaign.dailyBudgetUsd}/gün · {campaign.impressions} gösterim · {campaign.clicks} tıklama · ${campaign.spendUsd.toFixed(2)} harcandı
          </p>
          {campaign.lastError && <p className="text-[11px] text-red-400/80 mt-1 truncate">{campaign.lastError}</p>}
        </div>
        <StatusBadge status={campaign.status === "ACTIVE" ? "active" : "paused"} />
        <button
          onClick={toggle}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 text-white bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : campaign.status === "ACTIVE" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {campaign.status === "ACTIVE" ? "Duraklat" : "Aktif Et"}
        </button>
      </div>
    </Card>
  );
}
