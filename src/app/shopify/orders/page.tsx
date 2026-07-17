"use client";

import { PageHeader, InfoCard, Empty } from "@/components/shopify/shared";

export default function ShopifyOrdersPage() {
  return (
    <>
      <PageHeader
        title="Siparişler"
        subtitle="Shopify mağazalarına düşen siparişler burada listelenecek."
      />

      <div className="space-y-6 max-w-3xl">
        <Empty text="Henüz sipariş yok — mağaza bağlanınca siparişler otomatik buraya düşer." />

        <InfoCard
          title="Sipariş akışı"
          text="Sipariş düştüğünde sistem AliExpress'ten canlı stok/fiyat doğrulaması yapar (sipariş-anı koruması), takip kodu çevirme ve kargo takibi eBay/Amazon'daki sistemle aynı şekilde çalışır."
        />
      </div>
    </>
  );
}
