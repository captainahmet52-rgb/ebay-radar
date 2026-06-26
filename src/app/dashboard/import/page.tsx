"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DownloadCloud, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Loader2, Package, ShieldCheck, Info, ChevronLeft, ChevronRight,
} from "lucide-react";
import { fetcher } from "@/lib/fetcher";

interface EbayAccountMeta {
  id: string;
  ebayUserId: string;
  marketplace: string;
  isActive: boolean;
}

interface ListingImport {
  id: string;
  status: string;
  source: string;
  totalListings: number;
  processedListings: number;
  confirmedCount: number;
  reviewCount: number;
  unmatchedCount: number;
  totalPages: number | null;
  pageCursor: number | null;
  error: string | null;
  finishedAt: string | null;
  createdAt: string;
}

interface ImportedListing {
  id: string;
  ebayItemId: string;
  ebaySku: string | null;
  title: string | null;
  price: number | null;
  currency: string;
  quantity: number | null;
  imageUrl: string | null;
  detectedAsin: string | null;
  matchStatus: string;
  matchConfidence: number;
  matchReason: string | null;
  trackingEnabled: boolean;
}

const STATUS_TABS = [
  { key: "confirmed", label: "Onaylı", icon: CheckCircle2, color: "emerald" },
  { key: "review", label: "İncelenecek", icon: AlertTriangle, color: "amber" },
  { key: "pending", label: "Bekliyor", icon: Clock, color: "blue" },
  { key: "unmatched", label: "Eşleşmeyen", icon: XCircle, color: "slate" },
] as const;

const IN_PROGRESS = ["pending", "fetching", "matching"];

export default function ImportPage() {
  const { data: accountsResp } = useSWR<{ data: EbayAccountMeta[] }>("/api/ebay/accounts", fetcher);
  const accounts = accountsResp?.data ?? [];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const accountId = selectedId ?? accounts[0]?.id ?? null;

  const [busy, setBusy] = useState(false);
  // Satır-bazlı takip toggle busy — tek bir toggle TÜM butonları kilitlemesin.
  const [trackingBusy, setTrackingBusy] = useState<Set<string>>(new Set());
  const [tab, setTabRaw] = useState<(typeof STATUS_TABS)[number]["key"]>("confirmed");
  const [page, setPage] = useState(1);

  // Sekme değişince sayfayı 1'e döndür.
  const setTab = (t: (typeof STATUS_TABS)[number]["key"]) => {
    setTabRaw(t);
    setPage(1);
  };

  // Import durumu — devam ediyorsa 3 sn'de bir yenile
  const { data: importsResp, mutate: mutateImports } = useSWR<{ data: ListingImport[] }>(
    accountId ? `/api/ebay/import?ebayAccountId=${accountId}` : null,
    fetcher,
    { refreshInterval: (data) => (data?.data?.[0] && IN_PROGRESS.includes(data.data[0].status) ? 3000 : 0) }
  );
  const latest = importsResp?.data?.[0] ?? null;
  const running = latest ? IN_PROGRESS.includes(latest.status) : false;

  // İçe aktarılmış ilanlar (seçili sekme)
  const { data: listingsResp, mutate: mutateListings } = useSWR<{
    data: ImportedListing[];
    meta: { total: number; totalPages: number; statusCounts: Record<string, number> };
  }>(accountId ? `/api/ebay/imported-listings?ebayAccountId=${accountId}&status=${tab}&page=${page}` : null, fetcher);

  const listings = listingsResp?.data ?? [];
  const counts = listingsResp?.meta?.statusCounts ?? {};
  const totalPages = listingsResp?.meta?.totalPages ?? 1;

  const progressPct = useMemo(() => {
    if (!latest || !latest.totalPages || !latest.pageCursor) return running ? 5 : 0;
    return Math.min(99, Math.round((latest.pageCursor / latest.totalPages) * 100));
  }, [latest, running]);

  async function startImport() {
    if (!accountId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ebay/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebayAccountId: accountId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "İçe aktarma başlatılamadı.");
      }
      mutateImports();
    } finally {
      setBusy(false);
    }
  }

  async function runVerify() {
    if (!accountId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ebay/import/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ebayAccountId: accountId }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`${j.data?.enqueued ?? 0} ilan Amazon'da doğrulanmak üzere kuyruğa alındı. Sonuçlar birkaç dakika içinde güncellenir.`);
      } else {
        alert(j.error ?? "Doğrulama başlatılamadı.");
      }
      mutateListings();
    } finally {
      setBusy(false);
    }
  }

  async function toggleTracking(il: ImportedListing) {
    // Sadece bu satırı kilitle (global busy değil) → diğer satırlar/başlat etkilenmesin.
    setTrackingBusy((prev) => new Set(prev).add(il.id));
    try {
      const res = await fetch(`/api/ebay/imported-listings/${il.id}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !il.trackingEnabled }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "İşlem başarısız.");
      }
      mutateListings();
    } catch {
      alert("İşlem başarısız.");
    } finally {
      setTrackingBusy((prev) => {
        const next = new Set(prev);
        next.delete(il.id);
        return next;
      });
    }
  }

  const asinBearing = (counts.confirmed ?? 0) + (counts.review ?? 0) + (counts.pending ?? 0);

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <DownloadCloud className="h-6 w-6 text-violet-400" /> İlanları İçe Aktar
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Mağazandaki <span className="text-white font-medium">mevcut tüm eBay ilanlarını</span> sisteme çek —
          SKU'sunda ASIN olanlar Amazon'a karşı otomatik stok/fiyat takibine alınır.
        </p>
      </div>

      {/* Mağaza seçimi */}
      {accounts.length === 0 ? (
        <Card className="p-8 text-center">
          <Package className="h-9 w-9 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">Önce bir eBay mağazası bağla</p>
          <p className="text-sm text-slate-500 mt-1">İçe aktarma için bağlı bir mağaza gerekir.</p>
        </Card>
      ) : (
        <>
          <Card className="p-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Mağaza:</span>
              <select
                value={accountId ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.ebayUserId} ({a.marketplace.replace("EBAY_", "")})
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={startImport} loading={busy && !running} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
              {running ? "İçe aktarılıyor…" : latest ? "Yeniden İçe Aktar" : "İçe Aktarmayı Başlat"}
            </Button>
          </Card>

          {/* İlerleme / özet */}
          {latest && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300 font-medium flex items-center gap-2">
                  {running ? (
                    <><Loader2 className="h-4 w-4 animate-spin text-violet-400" /> Keşif sürüyor…</>
                  ) : latest.status === "completed" ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Keşif tamamlandı</>
                  ) : latest.status === "failed" ? (
                    <><XCircle className="h-4 w-4 text-red-400" /> Hata</>
                  ) : (
                    <><Clock className="h-4 w-4 text-blue-400" /> Sırada</>
                  )}
                </span>
                <span className="text-slate-400">
                  {latest.processedListings.toLocaleString()} ilan işlendi
                </span>
              </div>

              {running && (
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-blue-500"
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}

              {latest.error && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> {latest.error}
                </p>
              )}

              {latest.status === "completed" && (
                <div className="flex flex-wrap items-center gap-4 pt-1 text-sm">
                  <span className="text-slate-300">
                    Toplam: <b className="text-white">{latest.totalListings.toLocaleString()}</b>
                  </span>
                  <span className="text-emerald-400">
                    ASIN'li (takip edilebilir): <b>{asinBearing.toLocaleString()}</b>
                  </span>
                  <span className="text-slate-500">
                    Eşleşmeyen: <b>{(counts.unmatched ?? 0).toLocaleString()}</b>
                  </span>
                  {(counts.pending ?? 0) > 0 && (
                    <Button size="sm" variant="ghost" onClick={runVerify} loading={busy}>
                      <RefreshCw className="h-3.5 w-3.5" /> Amazon'da Doğrula ({(counts.pending ?? 0).toLocaleString()})
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* SIFIR HATA notu */}
          <Card className="p-3 flex items-start gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>
              <b className="text-slate-300">Sıfır hata güvencesi:</b> Sistem ASLA tahmin etmez. Bir ilan otomatik
              takibe ancak SKU'sunda gerçek ASIN varsa, Amazon başlığı eşleşiyorsa ve fiyat/model/paket çelişkisi
              yoksa alınır. Şüpheli olanlar <span className="text-amber-400">"İncelenecek"</span>e düşer — sen
              onaylamadan dokunulmaz.
            </span>
          </Card>

          {/* Durum sekmeleri */}
          {latest && (
            <>
              <div className="flex flex-wrap gap-2">
                {STATUS_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        active
                          ? "bg-violet-600/20 border border-violet-500/30 text-white"
                          : "bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                      <span className="text-xs opacity-70">({(counts[t.key] ?? 0).toLocaleString()})</span>
                    </button>
                  );
                })}
              </div>

              {/* İlan listesi */}
              <div className="space-y-2">
                {listings.length === 0 ? (
                  <Card className="p-8 text-center text-sm text-slate-500">
                    Bu durumda ilan yok.
                  </Card>
                ) : (
                  listings.map((il) => (
                    <Card key={il.id} className="p-3 flex items-center gap-3">
                      {il.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={il.imageUrl} alt="" className="w-12 h-12 rounded object-cover bg-slate-800 flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-slate-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{il.title ?? "(başlık yok)"}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                          <span>SKU: {il.ebaySku ?? "—"}</span>
                          {il.detectedAsin && <span className="text-violet-300">ASIN: {il.detectedAsin}</span>}
                          <span>{il.currency} {il.price?.toFixed(2) ?? "—"}</span>
                          <span>Stok: {il.quantity ?? "—"}</span>
                        </div>
                        {il.matchReason && tab !== "confirmed" && (
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Info className="h-3 w-3" /> {il.matchReason}
                          </p>
                        )}
                      </div>

                      {il.matchStatus === "confirmed" && (
                        <Button
                          size="sm"
                          variant={il.trackingEnabled ? "ghost" : undefined}
                          onClick={() => toggleTracking(il)}
                          loading={trackingBusy.has(il.id)}
                        >
                          {il.trackingEnabled ? (
                            <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Takipte</>
                          ) : (
                            <>Takibi Aç</>
                          )}
                        </Button>
                      )}
                    </Card>
                  ))
                )}
              </div>

              {/* Sayfalama — 50'den fazla ilan varsa tüm sayfalara erişim */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Önceki
                  </Button>
                  <span className="text-xs text-slate-400">
                    Sayfa {page} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Sonraki <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
