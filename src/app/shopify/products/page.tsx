"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Clapperboard, Megaphone, Copy, Check, ChevronDown, Package,
} from "lucide-react";
import { PageHeader, InfoCard, StatusBadge, SHOPIFY_ACCENT } from "@/components/shopify/shared";
import type { CampaignDraft } from "@/lib/campaign-draft";

interface ListingRow {
  id: string;
  status: string;
  salePrice: number | null;
  currentQty: number;
  lastError: string | null;
  product: { title: string | null; aliId: string; imageUrl: string | null; aliStockStatus: string };
  shopifyAccount: { shopDomain: string };
}

export default function ShopifyProductsPage() {
  const [listings, setListings] = useState<ListingRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shopify/listings");
    if (!res.ok) { setListings([]); return; }
    const j = await res.json();
    setListings(j.listings);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Ürünlerim"
        subtitle="Mağazalarına yüklediğin ürünler — her ürün için UGC video üret, AI kampanya taslağı al."
      />

      {listings === null ? (
        <div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      ) : listings.length === 0 ? (
        <div className="max-w-3xl space-y-4">
          <InfoCard
            title="Henüz yüklenmiş ürün yok"
            text="Depodan ürün seçip mağazana yüklediğinde burada listelenir — buradan video üretimi ve kampanya taslağına geçersin."
          />
          <Link
            href="/shopify/depot"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black"
            style={{ background: SHOPIFY_ACCENT }}
          >
            <Package className="h-4 w-4" /> Depoya Git
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </>
  );
}

function ListingCard({ listing }: { listing: ListingRow }) {
  const [draft, setDraft] = useState<CampaignDraft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftErr, setDraftErr] = useState("");
  const [open, setOpen] = useState(false);

  async function makeDraft() {
    setDraftBusy(true); setDraftErr("");
    try {
      const res = await fetch("/api/shopify/campaign-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const j = await res.json();
      if (!res.ok) { setDraftErr(j.error ?? "Taslak üretilemedi"); return; }
      setDraft(j.draft);
      setOpen(true);
    } catch {
      setDraftErr("Bağlantı hatası — tekrar dene");
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="p-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {listing.product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Package className="h-6 w-6 text-slate-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug line-clamp-2">{listing.product.title ?? "—"}</p>
          <p className="text-xs text-slate-500 mt-1">
            {listing.shopifyAccount.shopDomain} · ${listing.salePrice?.toFixed(2) ?? "—"} · {listing.currentQty} adet
          </p>
          {listing.lastError && (
            <p className="text-[11px] text-red-400/80 mt-1 truncate" title={listing.lastError}>
              Hata: {listing.lastError}
            </p>
          )}
        </div>
        <StatusBadge status={listing.status} />
      </div>

      {/* Eylem tuşları — sahibin istediği desen: ürünün altında tuşlar */}
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <Link
          href={`/shopify/videos?listing=${listing.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2"
          style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33`, color: SHOPIFY_ACCENT }}
        >
          <Clapperboard className="h-3.5 w-3.5" /> Video Üret
        </Link>
        <button
          onClick={draft ? () => setOpen(!open) : makeDraft}
          disabled={draftBusy}
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2 text-white bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition-colors"
        >
          {draftBusy
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Megaphone className="h-3.5 w-3.5" />}
          {draft ? "Kampanya Taslağı" : "AI Kampanya Taslağı"}
          {draft && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />}
        </button>
        {draftErr && <p className="text-xs text-red-400 self-center">{draftErr}</p>}
      </div>

      {draft && open && <DraftView draft={draft} />}
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-slate-500 hover:text-white transition-colors flex-shrink-0"
      title="Kopyala"
    >
      {copied ? <Check className="h-3.5 w-3.5" style={{ color: SHOPIFY_ACCENT }} /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DraftView({ draft }: { draft: CampaignDraft }) {
  return (
    <div className="border-t border-white/5 p-4 space-y-4 text-sm">
      {/* Aşama 1: AI'ın ürün araştırması */}
      <div className="rounded-xl p-3.5" style={{ background: `${SHOPIFY_ACCENT}0d`, border: `1px solid ${SHOPIFY_ACCENT}26` }}>
        <p className="text-[10.5px] font-bold uppercase tracking-wide mb-2" style={{ color: SHOPIFY_ACCENT }}>
          AI ürün araştırması
        </p>
        <p className="text-xs text-slate-300 leading-relaxed">{draft.researchNotes.productSummary}</p>
        <p className="text-xs text-slate-400 leading-relaxed mt-2">
          <span className="text-slate-300 font-semibold">Hedef kitle:</span> {draft.researchNotes.targetAudience}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed mt-1">
          <span className="text-slate-300 font-semibold">Satış açısı:</span> {draft.researchNotes.sellingAngle}
        </p>
      </div>

      {/* Aşama 2: kampanya taslağı — kopyala → Meta Ads Manager'a yapıştır */}
      <Field label="Kampanya adı" value={draft.campaignName} />
      <Field label="Başlık (headline)" value={draft.headline} />
      {draft.primaryTexts.map((t, i) => (
        <Field key={i} label={`Reklam metni ${i + 1}`} value={t} multiline />
      ))}
      <div>
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Hedef kitle önerileri (Meta'da arat)</p>
        <div className="flex flex-wrap gap-1.5">
          {draft.audienceSuggestions.map((a) => (
            <span key={a} className="text-[11px] rounded-full px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300">
              {a}
            </span>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Önerilen günlük bütçe: <span className="font-bold text-white">${draft.dailyBudgetSuggestionUsd}/gün</span>
        <span className="text-slate-600"> — taslağı kopyala, Meta Ads Manager'da kampanya oluştururken yapıştır.</span>
      </p>
    </div>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-black/30 border border-white/10">
        <p className={`text-xs text-slate-200 flex-1 ${multiline ? "leading-relaxed" : "truncate"}`}>{value}</p>
        <CopyBtn text={value} />
      </div>
    </div>
  );
}
