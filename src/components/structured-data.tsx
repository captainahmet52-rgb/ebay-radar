import { SITE } from "@/lib/site";
import { FAQ } from "@/lib/faq";

/** Tek bir JSON-LD script'i basar. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
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
      name: SITE.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE.url,
      description: SITE.description,
      inLanguage: "tr-TR",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "7 gün / 50 ürün ücretsiz deneme",
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
