"use client";
import useSWR from "swr";

interface StoreRow {
  id: string;
  ebayUsername: string;
  isActive: boolean;
  scanIntervalHours: number;
  lastScannedAt: string | null;
  due: boolean;
  counts: Record<string, number>;
}
interface TopProduct {
  asin: string;
  title: string | null;
  imageUrl: string | null;
  amazonPrice: number | null;
  calculatedEbayPrice: number | null;
  soldCount: number | null;
  projectedProfit: number | null;
  rankScore: number;
}
interface Decision {
  decision: string;
  asin: string | null;
  contract: string | null;
  reason: string;
  ebayTitle: string;
  soldCount?: number | null;
  rankScore?: number;
  ts: number;
}
interface RadarStats {
  depotByStatus: Record<string, number>;
  stores: StoreRow[];
  topProducts: TopProduct[];
  recentDecisions: Decision[];
  decisionDist: Record<string, number>;
  autopilot: { dueNow: number; activeStores: number };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json()) as Promise<RadarStats>;

function Stat({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : tone === "bad" ? "text-red-400" : "text-white";
  return (
    <div className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/60">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}

const DECISION_TONE: Record<string, string> = {
  accept: "text-emerald-400",
  review: "text-amber-400",
  skip: "text-slate-500",
};

function fmtDate(s: string | null): string {
  if (!s) return "hiç";
  const d = new Date(s);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function RadarPanelPage() {
  const { data, isLoading } = useSWR("/api/admin/radar/stats", fetcher, { refreshInterval: 30000 });

  if (isLoading || !data) return <p className="text-slate-400 text-sm">Yükleniyor…</p>;

  const d = data.depotByStatus;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Radar Zekâ Paneli</h1>
          <p className="text-sm text-slate-400 mt-1">Oto-pilot + para motoru (30 sn&apos;de bir yenilenir).</p>
        </div>
        <a href="/admin/depot/review" className="text-sm px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25">
          İnceleme kuyruğu →
        </a>
      </div>

      {/* Depo + oto-pilot */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Depo: aktif" value={d.active ?? 0} tone="good" />
        <Stat label="İnceleme bekliyor" value={d.review ?? 0} tone={(d.review ?? 0) > 0 ? "warn" : "default"} />
        <Stat label="Reddedilmiş" value={d.rejected ?? 0} />
        <Stat label="Oto-pilot: aktif mağaza" value={data.autopilot.activeStores} />
        <Stat label="Şimdi taranacak" value={data.autopilot.dueNow} tone={data.autopilot.dueNow > 0 ? "warn" : "good"} />
      </div>

      {/* Karar dağılımı (son pencere) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Son kararlar (dağılım)</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Kabul" value={data.decisionDist.accept ?? 0} tone="good" />
          <Stat label="İnceleme" value={data.decisionDist.review ?? 0} tone="warn" />
          <Stat label="Atlandı" value={data.decisionDist.skip ?? 0} />
        </div>
      </div>

      {/* Takip edilen mağazalar */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Takip edilen mağazalar (oto-pilot)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs">
              <tr>
                <th className="text-left p-2">Mağaza</th>
                <th className="text-left p-2">Aralık</th>
                <th className="text-left p-2">Son tarama</th>
                <th className="text-left p-2">Durum</th>
                <th className="text-right p-2">aktif/inceleme</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s) => (
                <tr key={s.id} className="border-t border-slate-800">
                  <td className="p-2 font-medium">{s.ebayUsername}</td>
                  <td className="p-2 text-slate-400">{s.scanIntervalHours <= 0 ? "manuel" : `${s.scanIntervalHours}s`}</td>
                  <td className="p-2 text-slate-400">{fmtDate(s.lastScannedAt)}</td>
                  <td className="p-2">
                    {!s.isActive ? <span className="text-slate-500">pasif</span>
                      : s.due ? <span className="text-amber-400">taranacak</span>
                      : <span className="text-emerald-400">güncel</span>}
                  </td>
                  <td className="p-2 text-right text-slate-300">{s.counts.active ?? 0}/{s.counts.review ?? 0}</td>
                </tr>
              ))}
              {data.stores.length === 0 && (
                <tr><td colSpan={5} className="p-3 text-center text-slate-500">Takip edilen mağaza yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* En kârlı/satan depo ürünleri */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-2">En yüksek skorlu ürünler (kâr × talep × rekabetçilik)</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-900/80 text-slate-400 text-xs">
              <tr>
                <th className="text-left p-2">Görsel</th>
                <th className="text-left p-2">ASIN</th>
                <th className="text-left p-2">Başlık</th>
                <th className="text-right p-2">Sold</th>
                <th className="text-right p-2">Amazon→eBay</th>
                <th className="text-right p-2">Net kâr</th>
                <th className="text-right p-2">Skor</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((t) => (
                <tr key={t.asin} className="border-t border-slate-800">
                  <td className="p-1.5">
                    {t.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.imageUrl} alt={t.title ?? t.asin} className="w-10 h-10 rounded object-cover bg-slate-800" loading="lazy" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-800 flex items-center justify-center text-slate-600 text-[10px]">yok</div>
                    )}
                  </td>
                  <td className="p-2 font-mono text-xs">{t.asin}</td>
                  <td className="p-2 text-slate-300 truncate max-w-[220px]">{t.title ?? "—"}</td>
                  <td className="p-2 text-right text-slate-400">{t.soldCount ?? "—"}</td>
                  <td className="p-2 text-right text-slate-400">
                    ${t.amazonPrice?.toFixed(0) ?? "?"}→${t.calculatedEbayPrice?.toFixed(0) ?? "?"}
                  </td>
                  <td className="p-2 text-right text-emerald-400">${t.projectedProfit?.toFixed(1) ?? "?"}</td>
                  <td className="p-2 text-right font-semibold">{t.rankScore.toFixed(1)}</td>
                </tr>
              ))}
              {data.topProducts.length === 0 && (
                <tr><td colSpan={7} className="p-3 text-center text-slate-500">Henüz ürün yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Son kararlar (audit) */}
      <div>
        <h2 className="text-sm font-semibold text-slate-300 mb-2">Son radar kararları</h2>
        <div className="space-y-1">
          {data.recentDecisions.map((dec, i) => (
            <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-slate-900/40 border border-slate-800">
              <span className={`font-semibold w-16 ${DECISION_TONE[dec.decision] ?? "text-slate-400"}`}>{dec.decision}</span>
              <span className="font-mono text-slate-500 w-24">{dec.asin ?? "—"}</span>
              <span className="text-slate-400 flex-1 truncate">{dec.ebayTitle}</span>
              <span className="text-slate-500 truncate max-w-[200px]">{dec.reason}</span>
            </div>
          ))}
          {data.recentDecisions.length === 0 && (
            <p className="text-slate-500 text-xs">Henüz karar kaydı yok (Redis boş veya tarama yapılmadı).</p>
          )}
        </div>
      </div>
    </div>
  );
}
