"use client";

import { PageHeader, Card, InfoCard, AMZ_ACCENT } from "@/components/amazon/shared";
import { DEFAULT_RADAR_CONFIG } from "@/lib/amazon-radar";

const ROWS: Array<{ label: string; value: string }> = [
  { label: "Hedef kâr marjı", value: `%${DEFAULT_RADAR_CONFIG.targetMargin * 100}` },
  { label: "Asgari kabul marjı", value: `%${DEFAULT_RADAR_CONFIG.minMarginPct}` },
  { label: "Maks. BSR (talep eşiği)", value: DEFAULT_RADAR_CONFIG.maxBsr.toLocaleString("tr-TR") },
  { label: "Aylık min. satış", value: String(DEFAULT_RADAR_CONFIG.minSalesEst) },
  { label: "Maks. satıcı (rekabet)", value: String(DEFAULT_RADAR_CONFIG.maxSellers) },
  { label: "AliExpress min. sipariş", value: String(DEFAULT_RADAR_CONFIG.minAliOrders) },
  { label: "AliExpress min. puan", value: String(DEFAULT_RADAR_CONFIG.minAliRating) },
  { label: "Fiyat aralığı", value: `${DEFAULT_RADAR_CONFIG.priceMin} – ${DEFAULT_RADAR_CONFIG.priceMax}` },
];

export default function AmazonSettingsPage() {
  return (
    <>
      <PageHeader title="Ayarlar" subtitle="Radar filtre eşikleri ve yükleme kuralları." />
      <div className="space-y-6 max-w-2xl">
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
          text="Şu an varsayılan eşikler kullanılıyor. Yakında bu değerleri (marj, BSR, fiyat aralığı, marka/yasak listesi) ve kendi yükleme kurallarını (kategori, limit, oto aç/kapa) buradan ayarlayabileceksin."
        />
      </div>
    </>
  );
}
