"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Copy, Check, Megaphone } from "lucide-react";
import { PageHeader, InfoCard, Card, SHOPIFY_ACCENT } from "@/components/shopify/shared";

interface AccountRow {
  id: string;
  shopDomain: string;
  metaPixelId: string | null;
  feedToken: string;
  accessState: string;
}

export default function ShopifyMetaPage() {
  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shopify/accounts");
    if (!res.ok) { setAccounts([]); return; }
    const j = await res.json();
    setAccounts(j.accounts);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Meta Reklamları"
        subtitle="Mağazandaki ürünleri Facebook/Instagram kataloğuna bağla — reklamlarını Meta panelinden ürün kataloğuyla açarsın."
      />

      <div className="space-y-6 max-w-3xl">
        <InfoCard
          title="Nasıl çalışır?"
          text="Aşağıdaki katalog besleme (feed) adresini Meta Commerce Manager'da 'Veri Kaynakları → Planlanmış Besleme' olarak eklersin — Meta ürünlerini düzenli çeker, stok bitince reklamdan otomatik düşer. Pixel ID'ni de kaydedersen dönüşüm takibi rehberi ona göre hazırlanır. Siteden tek tıkla kampanya açma (tam Meta entegrasyonu) sonraki aşamada gelecek."
        />

        {accounts === null ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </div>
        ) : accounts.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">
            Önce Mağazalar sayfasından bir Shopify mağazası bağla.
          </p>
        ) : (
          accounts.map((a) => <AccountMetaCard key={a.id} account={a} />)
        )}
      </div>
    </>
  );
}

function AccountMetaCard({ account }: { account: AccountRow }) {
  const [pixel, setPixel] = useState(account.metaPixelId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  const feedUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/shopify/meta-feed/${account.feedToken}`
      : "";

  async function savePixel() {
    setSaving(true); setErr(""); setSaved(false);
    try {
      const res = await fetch(`/api/shopify/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metaPixelId: pixel.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? "Kaydedilemedi");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
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
      <p className="font-bold mb-4 flex items-center gap-2">
        <Megaphone className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> {account.shopDomain}
      </p>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-slate-400 mb-1.5">Katalog besleme adresi (Meta Commerce Manager'a yapıştır)</p>
          <div className="flex gap-2">
            <code className="flex-1 text-[11px] rounded-lg px-3 py-2.5 bg-black/40 border border-white/10 text-slate-300 truncate">
              {feedUrl}
            </code>
            <button
              onClick={copyFeed}
              className="px-3 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors"
              title="Kopyala"
            >
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
            <button
              onClick={savePixel}
              disabled={saving}
              className="px-4 rounded-lg text-sm font-bold text-black disabled:opacity-50"
              style={{ background: SHOPIFY_ACCENT }}
            >
              {saving ? "…" : saved ? "✓" : "Kaydet"}
            </button>
          </div>
          {err && <p className="text-xs text-red-400 mt-1.5">{err}</p>}
        </div>
      </div>
    </Card>
  );
}
