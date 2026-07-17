"use client";

import { PageHeader, InfoCard, Empty } from "@/components/shopify/shared";

export default function ShopifyDepotPage() {
  return (
    <>
      <PageHeader
        title="Depo"
        subtitle="Takipteki AliExpress ürünleri — buradan seçip Shopify mağazana yükleyeceksin."
      />

      <div className="space-y-6 max-w-3xl">
        <Empty text="Depo bağlantısı yakında — ortak ürün havuzu (AliExpress) buraya bağlanacak." />

        <InfoCard
          title="Ortak depo"
          text="Depo tüm kanalların ortak ürün havuzudur: aynı ürünü istersen Amazon'a, istersen Shopify'a (ya da ikisine birden) yüklersin. Stok ve fiyat takibi ürün başına bir kez yapılır, yüklendiği her kanala otomatik yansır."
        />
      </div>
    </>
  );
}
