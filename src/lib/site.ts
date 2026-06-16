/**
 * Merkezi site yapılandırması — SEO / GEO / AEO için tek kaynak.
 * Gerçek alan adı alınınca .env içine NEXT_PUBLIC_SITE_URL ekle.
 */
export const SITE = {
  name: "Lean Automation",
  shortName: "Lean Automation",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lean-automation.com").replace(/\/$/, ""),
  locale: "tr_TR",
  title: "Lean Automation | Amazon, eBay ve Etsy Pazar Yeri Otomasyonu",
  description:
    "Amazon, eBay ve Etsy satıcıları için yapay zeka destekli pazar yeri otomasyonu. Ürün listeleme, fiyatlandırma, stok takibi ve sipariş yönetimini tek panelden otomatikleştir. 7 gün ücretsiz dene.",
  keywords: [
    "eBay otomasyon",
    "Amazon otomasyon",
    "Etsy otomasyon",
    "pazar yeri otomasyonu",
    "dropshipping yazılımı",
    "eBay listeleme aracı",
    "otomatik fiyatlandırma",
    "repricer",
    "stok takibi",
    "e-ticaret otomasyon",
    "eBay repricer",
    "Lean Automation",
  ],
} as const;

export const absoluteUrl = (path = ""): string =>
  `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
