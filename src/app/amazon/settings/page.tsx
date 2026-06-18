"use client";

import { PageHeader, Card, InfoCard, AMZ_ACCENT } from "@/components/amazon/shared";
import { DEFAULT_RADAR_CONFIG } from "@/lib/amazon-radar";
import { AMAZON_MARKETS } from "@/lib/amazon-repricer";

const MARKETS = Object.values(AMAZON_MARKETS);

const ROWS: Array<{ label: string; value: string }> = [
  { label: "Asgari kabul marjı", value: `%${DEFAULT_RADAR_CONFIG.minMarginPct}` },
  { label: "Maks. BSR (talep eşiği)", value: DEFAULT_RADAR_CONFIG.maxBsr.toLocaleString("tr-TR") },
  { label: "Aylık min. satış", value: String(DEFAULT_RADAR_CONFIG.minSalesEst) },
  { label: "Maks. satıcı (rekabet)", value: String(DEFAULT_RADAR_CONFIG.maxSellers) },
  { label: "AliExpress min. sipariş", value: String(DEFAULT_RADAR_CONFIG.minAliOrders) },
  { label: "AliExpress min. puan", value: String(DEFAULT_RADAR_CONFIG.minAliRating) },
];

export default function AmazonSettingsPage() {
  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Pazar başına kâr marjı ve radar filtre eşikleri." />
      <div className="space-y-6 max-w-3xl">
        {/* Pazar başına marj + vergi */}
        <div>
          <h2 className="text-lg font-bold mb-1">Pazar başına kâr marjı</h2>
          <p className="text-sm text-slate-400 mb-3">
            Her pazarın KDV ve gümrüğü farklı — bu yüzden marj da pazara göre ayarlanır.
            Fiyat bu marja göre KDV ve gümrük dahil otomatik hesaplanır.
          </p>
          <Card pad="p-0">
            <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-xs font-semibold text-slate-500 border-b border-white/5">
              <span className="col-span-2">Pazar</span>
              <span className="text-right">Marj</span>
              <span className="text-right">KDV</span>
              <span className="text-right">Gümrük</span>
            </div>
            {MARKETS.map((m) => (
              <div key={m.key} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-white/5 last:border-0">
                <span className="col-span-2 text-sm">{m.name}</span>
                <span className="text-right text-sm font-bold" style={{ color: AMZ_ACCENT }}>
                  %{Math.round(m.defaultMargin * 100)}
                </span>
                <span className="text-right text-sm text-slate-400">%{Math.round(m.vatRate * 100)}</span>
                <span className="text-right text-sm text-slate-400">%{Math.round(m.customsDutyRate * 100)}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* Radar eşikleri */}
        <div>
          <h2 className="text-lg font-bold mb-3">Radar eşikleri</h2>
          <Card pad="p-0">
            <div className="divide-y divide-white/5">
              {ROWS.map((r) => (
                <div key={r.label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-slate-400">{r.label}</span>
                  <span className="text-sm font-semibold" style={{ color: AMZ_ACCENT }}>{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <InfoCard
          title="Düzenlenebilir ayarlar yakında"
          text="Şu an pazar başına varsayılan marjlar (US %20, UK/UAE %25, Suudi %30) ve eşikler kullanılıyor. Yakında bu değerleri (pazar marjı, BSR, fiyat aralığı, marka/yasak listesi) ve kendi yükleme kurallarını (kategori, limit, oto aç/kapa) buradan ayarlayabileceksin."
        />
      </div>
    </>
  );
}
