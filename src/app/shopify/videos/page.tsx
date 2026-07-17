"use client";

import { Clapperboard } from "lucide-react";
import { PageHeader, InfoCard, SHOPIFY_ACCENT, SHOPIFY_ACCENT2 } from "@/components/shopify/shared";

/**
 * UGC Video paneli — İSKELET.
 * Plan: kullanıcı yüklediği üründen "Video Üret" der → ürün görsellerinden
 * UGC tarzı tanıtım videosu üretilir (AI) → indirir, Meta reklamında kullanır.
 * Üretim maliyetli olduğu için KREDİ CÜZDANINDAN düşülecek (takip kodu
 * sistemiyle aynı cüzdan). Üretim motoru sonraki aşamada bağlanacak.
 */
export default function ShopifyVideosPage() {
  const steps = [
    { n: "1", t: "Ürününü seç", d: "Mağazana yüklediğin üründen 'Video Üret' de." },
    { n: "2", t: "AI videonu üretsin", d: "Ürün görsellerinden UGC tarzı, reklama hazır kısa video." },
    { n: "3", t: "İndir, reklamda kullan", d: "Videoyu indir, Meta/TikTok reklamlarında kullan." },
  ];

  return (
    <>
      <PageHeader
        title="UGC Video"
        subtitle="Seçtiğin ürün için yapay zekayla UGC tarzı tanıtım videosu üret — reklam kreatifin hazır olsun."
      />

      <div className="space-y-6 max-w-3xl">
        <div className="relative rounded-3xl overflow-hidden p-8 md:p-10"
          style={{
            background: "linear-gradient(180deg, rgba(14,20,10,0.7) 0%, rgba(6,10,6,0.85) 100%)",
            border: `1px solid ${SHOPIFY_ACCENT}26`,
          }}>
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}40` }}>
              <Clapperboard className="h-7 w-7" style={{ color: SHOPIFY_ACCENT }} />
            </div>
            <h2 className="text-2xl font-black mb-2">Video üretimi yakında</h2>
            <p className="text-slate-400 max-w-xl leading-relaxed mb-8">
              Üretim motoru bağlanıyor. Açıldığında akış şöyle olacak:
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              {steps.map((s) => (
                <div key={s.n} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-black flex-shrink-0"
                    style={{ background: `linear-gradient(135deg,${SHOPIFY_ACCENT},${SHOPIFY_ACCENT2})` }}>
                    {s.n}
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{s.t}</p>
                    <p className="text-slate-400 text-xs leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <InfoCard
          title="Kredili sistem"
          text="Video üretimi yapay zeka maliyeti nedeniyle kredi cüzdanından düşülecek (takip kodu sistemindeki cüzdanın aynısı). Video başına kredi fiyatı üretim motoru bağlanınca netleşecek."
        />
      </div>
    </>
  );
}
