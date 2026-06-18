"use client";

import { PageHeader, InfoCard } from "@/components/amazon/shared";

export default function AmazonProductsPage() {
  return (
    <>
      <PageHeader title="Ürünler" subtitle="Amazon mağazana yüklenmiş ürünler." />
      <InfoCard
        title="Listeleme yakında"
        text="Ürün listeleme Amazon SP-API ile yapılacak (profesyonel satıcı hesabı + getListingsRestrictions kontrolü). Depodan seçilen kazananlar buraya yüklenince listelenecek."
      />
    </>
  );
}
