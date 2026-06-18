"use client";

import { PageHeader, InfoCard } from "@/components/amazon/shared";

export default function AmazonOrdersPage() {
  return (
    <>
      <PageHeader title="Siparişler" subtitle="Amazon siparişleri ve AliExpress'e otomatik aktarım." />
      <InfoCard
        title="Sipariş yönetimi yakında"
        text="Amazon siparişleri SP-API ile çekilecek; satış anında AliExpress'ten ürün otomatik sipariş edilip takip numarası Amazon'a girilecek."
      />
    </>
  );
}
