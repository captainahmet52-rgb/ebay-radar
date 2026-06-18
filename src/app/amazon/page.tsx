"use client";

import Link from "next/link";
import { Radar, Trophy, XCircle, Gauge, ArrowRight, TrendingUp } from "lucide-react";
import {
  AmazonReady, PageHeader, Stat, Card, AMZ_ACCENT,
  useAmazonData,
} from "@/components/amazon/shared";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

export default function AmazonPanelPage() {
  const { market } = useAmazonData();
  const symbol = AMAZON_MARKETS[market]?.symbol ?? "$";

  return (
    <>
      <PageHeader
        title="AmazonBot Paneli"
        subtitle="Radar AliExpress'ten kazanan ürünleri bulur, Amazon'da doğrular ve kâr/marka filtresinden geçirir."
      />
      <AmazonReady>
        {(data) => {
          const winners = data.results.filter((r) => r.verdict.pass);
          const rejected = data.results.length - winners.length;
          const avgScore = winners.length
            ? Math.round(winners.reduce((s, r) => s + r.verdict.score, 0) / winners.length)
            : 0;

          return (
            <div className="space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={Radar} label="Taranan aday" value={data.total} />
                <Stat icon={Trophy} label="Kazanan" value={winners.length} sub="radardan geçti" />
                <Stat icon={XCircle} label="Elenen" value={rejected} sub="filtreye takıldı" />
                <Stat icon={Gauge} label="Ort. skor" value={avgScore} sub="/100" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold">En iyi kazananlar</h2>
                  <Link href="/amazon/depot" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                    Tümü <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {winners.slice(0, 6).map((r) => (
                    <Card key={r.candidate.aliId}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}40`, color: AMZ_ACCENT }}>
                          {r.verdict.score}/100
                        </span>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      </div>
                      <p className="text-sm font-medium leading-snug line-clamp-2">{r.candidate.title}</p>
                      {r.verdict.pricing && (
                        <p className="text-xs text-slate-400 mt-2">
                          Satış {symbol}{r.verdict.pricing.salePrice} · Kâr {symbol}{r.verdict.pricing.netProfit} (%{r.verdict.pricing.marginPct})
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
                {winners.length === 0 && (
                  <p className="text-slate-500 text-sm py-8 text-center rounded-xl"
                    style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    Bu pazarda radardan geçen ürün yok. Eşikleri Ayarlar&apos;dan gevşetebilirsin.
                  </p>
                )}
              </div>
            </div>
          );
        }}
      </AmazonReady>
    </>
  );
}
