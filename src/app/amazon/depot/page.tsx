"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { AmazonReady, PageHeader, Card, AMZ_ACCENT, useAmazonData } from "@/components/amazon/shared";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

export default function AmazonDepotPage() {
  const { market } = useAmazonData();
  const symbol = AMAZON_MARKETS[market]?.symbol ?? "$";

  return (
    <>
      <PageHeader
        title="Radar & Depo"
        subtitle="Radarın bulduğu tüm adaylar. Geçenler depoya alınır; elenenler sebebiyle gösterilir."
      />
      <AmazonReady>
        {(data) => (
          <div className="space-y-2.5">
            {data.results.map((r) => {
              const pass = r.verdict.pass;
              return (
                <Card key={r.candidate.aliId} pad="p-4">
                  <div className="flex items-start gap-3">
                    {pass ? (
                      <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: AMZ_ACCENT }} />
                    ) : (
                      <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-400/80" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{r.candidate.title}</p>
                        {pass && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: `${AMZ_ACCENT}1f`, border: `1px solid ${AMZ_ACCENT}40`, color: AMZ_ACCENT }}>
                            {r.verdict.score}/100
                          </span>
                        )}
                      </div>
                      {pass && r.verdict.pricing ? (
                        <p className="text-xs text-slate-400 mt-1">
                          Maliyet {symbol}{r.candidate.aliCost} → Satış {symbol}{r.verdict.pricing.salePrice} ·
                          {" "}Kâr {symbol}{r.verdict.pricing.netProfit} (%{r.verdict.pricing.marginPct})
                          {r.candidate.amazonBsr ? ` · BSR ${r.candidate.amazonBsr}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-red-300/70 mt-1">{r.verdict.reasons.join(" · ")}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </AmazonReady>
    </>
  );
}
