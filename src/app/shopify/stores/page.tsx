"use client";

import { Store, Plug } from "lucide-react";
import { PageHeader, InfoCard, SHOPIFY_ACCENT } from "@/components/shopify/shared";

export default function ShopifyStoresPage() {
  return (
    <>
      <PageHeader
        title="Mağazalar"
        subtitle="Shopify mağazalarını buradan bağlayacak ve yöneteceksin — her mağaza kendi paketiyle çalışır (eBay/Amazon ile aynı model)."
      />

      <div className="space-y-6 max-w-3xl">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.12)" }}
        >
          <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center mb-4"
            style={{ background: `${SHOPIFY_ACCENT}1a`, border: `1px solid ${SHOPIFY_ACCENT}33` }}>
            <Store className="h-6 w-6" style={{ color: SHOPIFY_ACCENT }} />
          </div>
          <p className="font-bold mb-1.5">Henüz bağlı mağaza yok</p>
          <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
            Mağaza bağlama (Shopify OAuth) yakında açılıyor. Açıldığında buradaki butonla
            mağazanı 1 dakikada bağlayabileceksin.
          </p>
          <button
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black opacity-50 cursor-not-allowed"
            style={{ background: SHOPIFY_ACCENT }}
          >
            <Plug className="h-4 w-4" /> Mağaza Bağla (yakında)
          </button>
        </div>

        <InfoCard
          title="Nasıl çalışacak?"
          text="Shopify mağazanı bağladığında depodan seçtiğin ürünler mağazana yüklenir. AliExpress stok/fiyat değişimleri otomatik yansır; stoğu biten ürün Shopify'da kapanır, oversell yaşanmaz."
        />
      </div>
    </>
  );
}
