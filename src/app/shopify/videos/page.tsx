"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Clapperboard, Loader2, Copy, Check, Package, Sparkles, Upload, Download, Film } from "lucide-react";
import { PageHeader, SHOPIFY_ACCENT } from "@/components/shopify/shared";
import type { UgcScript } from "@/lib/ugc-script";

interface ListingRow {
  id: string;
  salePrice: number | null;
  product: { title: string | null; imageUrl: string | null };
  shopifyAccount: { shopDomain: string };
}

// useSearchParams (?listing=) Next 15'te Suspense sınırı ister
export default function ShopifyVideosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-slate-400 py-16 justify-center text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
        </div>
      }
    >
      <VideosContent />
    </Suspense>
  );
}

function VideosContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("listing");

  const [listings, setListings] = useState<ListingRow[] | null>(null);
  const [selectedId, setSelectedId] = useState(preselected ?? "");
  const [script, setScript] = useState<UgcScript | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/shopify/listings")
      .then((res) => (res.ok ? res.json() : { listings: [] }))
      .then((j) => setListings(j.listings ?? []))
      .catch(() => setListings([]));
  }, []);

  async function generate() {
    if (!selectedId) return;
    setBusy(true); setErr(""); setScript(null);
    try {
      const res = await fetch("/api/shopify/ugc-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: selectedId }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "Senaryo üretilemedi"); return; }
      setScript(j.script);
    } catch {
      setErr("Bağlantı hatası — tekrar dene");
    } finally {
      setBusy(false);
    }
  }

  const selected = listings?.find((l) => l.id === selectedId);

  return (
    <>
      <PageHeader
        title="UGC Video"
        subtitle="Ürününü seç, AI çekime hazır UGC senaryosu yazsın — hook'lar, sahne sahne çekim planı ve reklam metni. Video render motoru da yolda."
      />

      <div className="space-y-6 max-w-4xl">
        {/* Ürün seçimi + üretim */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <p className="font-bold mb-4 flex items-center gap-2">
            <Clapperboard className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> Senaryo üret
          </p>

          {listings === null ? (
            <div className="flex items-center gap-2 text-slate-400 py-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Ürünlerin yükleniyor...
            </div>
          ) : listings.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Henüz yüklenmiş ürünün yok — önce depodan mağazana ürün yükle, sonra buradan senaryo üret.
            </p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={selectedId}
                onChange={(e) => { setSelectedId(e.target.value); setScript(null); setErr(""); }}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-white/5 border border-white/10 outline-none focus:border-lime-500/50 text-white [&>option]:bg-slate-900"
              >
                <option value="">Ürün seç...</option>
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {(l.product.title ?? "Ürün").slice(0, 70)} — {l.shopifyAccount.shopDomain}
                  </option>
                ))}
              </select>
              <button
                onClick={generate}
                disabled={busy || !selectedId}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{ background: SHOPIFY_ACCENT }}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? "Yazılıyor..." : "Senaryo Üret"}
              </button>
            </div>
          )}
          {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

          {selected && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/5">
              <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {selected.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.product.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-5 w-5 text-slate-600" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selected.product.title ?? "—"}</p>
                <p className="text-xs text-slate-500">
                  {selected.shopifyAccount.shopDomain} · ${selected.salePrice?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>
          )}
        </div>

        {script && <ScriptView script={script} />}

        {/* Otomatik video üretimi — Lumina motoru (Kling Avatar v2 + ElevenLabs) */}
        <VideoGenerator listingId={selectedId} />
      </div>
    </>
  );
}

interface VideoJob {
  id: string;
  status: string;
  step: string | null;
  quality: string;
  seconds: number;
  spokenText: string | null;
  videoUrl: string | null;
  error: string | null;
}

function VideoGenerator({ listingId }: { listingId: string }) {
  const [charFile, setCharFile] = useState<File | null>(null);
  const [charPreview, setCharPreview] = useState("");
  const [quality, setQuality] = useState<"standard" | "pro">("standard");
  const [seconds, setSeconds] = useState<15 | 30 | 45>(15);
  const [prices, setPrices] = useState<{ std: number; pro: number } | null>(null);
  const [job, setJob] = useState<VideoJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/shopify/ugc-video")
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => {
        if (j) setPrices({ std: j.priceUsd, pro: j.priceProUsd });
      })
      .catch(() => {});
  }, []);

  // İş sürerken 5 sn'de bir durum yokla (her yoklama fal kuyruğunu kontrol eder)
  useEffect(() => {
    if (!job || job.status !== "processing") return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/shopify/ugc-video/${job.id}`);
        if (!res.ok) return;
        const j = await res.json();
        setJob(j.job);
      } catch { /* geçici — sonraki turda tekrar */ }
    }, 5000);
    return () => clearInterval(t);
  }, [job]);

  function pickFile(f: File | null) {
    setCharFile(f);
    setCharPreview(f ? URL.createObjectURL(f) : "");
  }

  async function generate() {
    if (!listingId || !charFile) return;
    setBusy(true); setErr(""); setJob(null);
    try {
      // 1. Karakter fotoğrafını yükle
      const fd = new FormData();
      fd.append("image", charFile);
      const up = await fetch("/api/shopify/ugc-video/character", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok || !upJson.url) { setErr(upJson.error ?? "Fotoğraf yüklenemedi"); return; }

      // 2. Üretimi başlat (FAZ 1 ~15-30 sn sürer)
      const res = await fetch("/api/shopify/ugc-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, characterImageUrl: upJson.url, quality, seconds }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "Üretim başlatılamadı"); return; }

      // 3. Durum yoklamaya başla
      const st = await fetch(`/api/shopify/ugc-video/${j.jobId}`);
      const stJson = await st.json();
      setJob(st.ok ? stJson.job : { id: j.jobId, status: "processing", step: "Üretiliyor…", quality, seconds, spokenText: null, videoUrl: null, error: null });
    } catch {
      setErr("Bağlantı hatası — tekrar dene");
    } finally {
      setBusy(false);
    }
  }

  const price = quality === "pro" ? prices?.pro : prices?.std;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="font-bold mb-1.5 flex items-center gap-2">
        <Film className="h-4 w-4" style={{ color: SHOPIFY_ACCENT }} /> Otomatik video üret (AI)
      </p>
      <p className="text-slate-400 text-xs mb-4 leading-relaxed max-w-xl">
        Bir oyuncu fotoğrafı yükle — AI ürünü oyuncunun eline/üstüne yerleştirir, doğal İngilizce
        konuşma yazar, seslendirir ve konuşan UGC videosunu üretir. Ücret kredi cüzdanından düşer;
        üretim başarısız olursa otomatik iade edilir.
      </p>

      {!listingId ? (
        <p className="text-slate-500 text-sm">Önce yukarıdan bir ürün seç.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            {/* Karakter fotoğrafı */}
            <label
              className="flex items-center gap-2 text-xs font-bold rounded-xl px-4 py-2.5 cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              {charFile ? "Fotoğrafı değiştir" : "Oyuncu fotoğrafı yükle"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {charPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={charPreview} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10" />
            )}

            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value as "standard" | "pro")}
              className="rounded-xl px-3 py-2.5 text-xs bg-white/5 border border-white/10 outline-none text-white [&>option]:bg-slate-900"
            >
              <option value="standard">Standart kalite</option>
              <option value="pro">Pro kalite</option>
            </select>

            <select
              value={seconds}
              onChange={(e) => setSeconds(Number(e.target.value) as 15 | 30 | 45)}
              className="rounded-xl px-3 py-2.5 text-xs bg-white/5 border border-white/10 outline-none text-white [&>option]:bg-slate-900"
            >
              <option value={15}>~15 saniye</option>
              <option value={30}>~30 saniye</option>
              <option value={45}>~45 saniye</option>
            </select>

            <button
              onClick={generate}
              disabled={busy || !charFile || (job?.status === "processing")}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-50 inline-flex items-center gap-2"
              style={{ background: SHOPIFY_ACCENT }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
              {busy ? "Başlatılıyor..." : `Video Üret${price ? ` · $${price.toFixed(2)}` : ""}`}
            </button>
          </div>
          {err && <p className="text-xs text-red-400 mt-3">{err}</p>}

          {/* İş durumu */}
          {job && (
            <div className="mt-5 pt-5 border-t border-white/5">
              {job.status === "processing" && (
                <div className="flex items-center gap-3 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: SHOPIFY_ACCENT }} />
                  {job.step ?? "Üretiliyor…"}
                </div>
              )}
              {job.status === "failed" && (
                <p className="text-sm text-red-400">{job.error ?? "Üretim başarısız — kredin iade edildi."}</p>
              )}
              {job.status === "completed" && job.videoUrl && (
                <div className="space-y-3">
                  <video
                    src={job.videoUrl}
                    controls
                    playsInline
                    className="w-full max-w-sm rounded-xl border border-white/10"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`/api/shopify/ugc-video/${job.id}/download`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3.5 py-2 text-black"
                      style={{ background: SHOPIFY_ACCENT }}
                    >
                      <Download className="h-3.5 w-3.5" /> Videoyu İndir
                    </a>
                    <span className="text-xs text-slate-500">Meta/TikTok reklamında kullanmaya hazır.</span>
                  </div>
                  {job.spokenText && (
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                      <span className="text-slate-300 font-semibold">Konuşulan metin:</span> {job.spokenText}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TEMPO_COLOR: Record<string, string> = {
  hızlı: "#f97316",
  sakin: "#3b82f6",
  yükselen: "#22c55e",
};

function ScriptView({ script }: { script: UgcScript }) {
  return (
    <div className="space-y-4">
      {/* Aşama 1: AI'ın ürün araştırması */}
      <div className="rounded-2xl p-5" style={{ background: `${SHOPIFY_ACCENT}0d`, border: `1px solid ${SHOPIFY_ACCENT}26` }}>
        <p className="text-[10.5px] font-bold uppercase tracking-wide mb-2" style={{ color: SHOPIFY_ACCENT }}>
          AI ürün araştırması
        </p>
        <p className="text-xs text-slate-300 leading-relaxed">{script.researchNotes.productSummary}</p>
        <p className="text-xs text-slate-400 leading-relaxed mt-2">
          <span className="text-slate-300 font-semibold">Hedef kitle:</span> {script.researchNotes.targetAudience}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed mt-1">
          <span className="text-slate-300 font-semibold">Satış açısı:</span> {script.researchNotes.sellingAngle}
        </p>
      </div>

      {/* Hook alternatifleri */}
      <Section title={`Hook alternatifleri (ilk 1-2 saniye — birini seç)`}>
        <div className="space-y-2">
          {script.hooks.map((h, i) => (
            <CopyRow key={i} text={h} />
          ))}
        </div>
      </Section>

      {/* Sahne planı */}
      <Section title={`Çekim planı · hedef süre ~${script.durationSeconds} sn`}>
        <div className="space-y-3">
          {script.scenes.map((s, i) => (
            <div key={i} className="rounded-xl p-3.5 bg-black/30 border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-bold text-slate-200">
                  {i + 1}. {s.label}
                </p>
                <span
                  className="text-[10px] font-medium rounded-full px-2 py-0.5"
                  style={{
                    color: TEMPO_COLOR[s.tempo] ?? "#94a3b8",
                    border: `1px solid ${TEMPO_COLOR[s.tempo] ?? "#94a3b8"}55`,
                    background: `${TEMPO_COLOR[s.tempo] ?? "#94a3b8"}14`,
                  }}
                >
                  tempo: {s.tempo}
                </span>
              </div>
              <CopyRow text={s.voiceover} />
              <p className="text-[11px] text-slate-500 mt-2">
                🎥 <span className="text-slate-400">{s.broll}</span>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Caption + hashtag */}
      <Section title="Reklam metni (caption)">
        <CopyRow text={script.caption} />
        <div className="flex flex-wrap gap-1.5 mt-3">
          {script.hashtags.map((h) => (
            <span key={h} className="text-[11px] rounded-full px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300">
              {h}
            </span>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 mb-3">{title}</p>
      {children}
    </div>
  );
}

function CopyRow({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 bg-black/30 border border-white/10">
      <p className="text-xs text-slate-200 flex-1 leading-relaxed">{text}</p>
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
    </div>
  );
}
