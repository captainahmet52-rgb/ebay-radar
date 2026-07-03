import { SITE } from "@/lib/site";
import { FAQ } from "@/lib/faq";
import { PLAN_LIST } from "@/lib/plans";

const FEATURE_LIST = [
  "Amazon → eBay otomatik ürün listeleme",
  "Pazar yerine göre akıllı fiyatlandırma (repricer)",
  "Stok ve fiyat senkronizasyonu",
  "Sipariş anı canlı doğrulama",
  "Çoklu mağaza yönetimi",
  "Otomatik sipariş takibi ve iade yönetimi",
  "Kâr ve performans analitiği",
  "Amazon ve Etsy pazar yeri desteği",
];

const prices = PLAN_LIST.map((p) => p.priceMonthly);
const LOW_PRICE = Math.min(...prices).toFixed(2);
const HIGH_PRICE = Math.max(...prices).toFixed(2);

/** Tek bir JSON-LD script'i basar. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // `<` kaçırılır → veriye "</script>" girse bile script'ten kaçış olmaz (XSS savunması)
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * Site geneli yapısal veri — sunucuda render edilir, ilk HTML'de yer alır.
 * Organization + WebSite + SoftwareApplication.
 * SEO (Google), GEO (üretken AI motorları) ve AEO (yanıt motorları) için.
 */
export function StructuredData() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/favicon.svg`,
      description: SITE.description,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      inLanguage: "tr-TR",
      publisher: { "@id": `${SITE.url}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE.url}/#software`,
      name: SITE.name,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "E-commerce Automation",
      operatingSystem: "Web",
      url: SITE.url,
      description: SITE.description,
      inLanguage: "tr-TR",
      featureList: FEATURE_LIST,
      publisher: { "@id": `${SITE.url}/#organization` },
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: LOW_PRICE,
        highPrice: HIGH_PRICE,
        offerCount: PLAN_LIST.length,
        description: "Mağaza başına 7 gün / 50 ürün ücretsiz deneme; aylık paketler.",
      },
    },
  ];

  return <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />;
}

/** Ana sayfaya özel FAQPage yapısal verisi (AEO). */
export function FaqStructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return <JsonLd data={data} />;
}
