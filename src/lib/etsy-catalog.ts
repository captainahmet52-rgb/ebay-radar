/**
 * EtsyFlow üretim kataloğu — kategori → alt kategori (üretim hattı) listesi.
 *
 * KRİTİK KURAL: Bu liste etsyflow-automation/index.js'teki AUTOMATION_MAP ile
 * birebir aynı olmalı. Panel mağaza formunu SADECE buradan doldurur; haritada
 * karşılığı olmayan bir alt kategori burada da olmamalı — aksi halde o mağaza
 * için üretim sessizce atlanır ("Mum tutucu" vakası, denetim 2026-08-06).
 */

export interface EtsyCatalogCategory {
  /** AUTOMATION_MAP anahtarıyla birebir aynı olmak zorunda */
  name: string;
  icon: string;
  description: string;
  subCategories: readonly string[];
}

export const ETSY_CATALOG: readonly EtsyCatalogCategory[] = [
  {
    name: "Punch Needle",
    icon: "🪡",
    description: "El yapımı punch needle işleme ürünleri",
    subCategories: [
      "Tek Taraflı Anahtarlık",
      "Yastık kılıfı",
      "Bardak altlığı",
      "Broş",
      "Mousepad",
    ],
  },
  {
    name: "Crochet",
    icon: "🧶",
    description: "Tığ işi örgü ürünler",
    subCategories: ["Anahtarlık", "Amigurumi", "Dönence"],
  },
  {
    name: "3D",
    icon: "🖨️",
    description: "3D baskı dekoratif ve fonksiyonel ürünler",
    subCategories: [
      "Anahtarlık",
      "Figure",
      "Kalemlik",
      "Saksı",
      "Diş fırçalığı",
      "Telefon standı",
      "Masa organizeri",
      "Mum tutucu",
      "Araba parfümü",
    ],
  },
  {
    name: "Tshirt",
    icon: "👕",
    description: "Print-on-demand tişört tasarımları",
    subCategories: ["POD tasarımları"],
  },
  {
    name: "Cam Saat",
    icon: "🕐",
    description: "İç mekan temalı cam duvar saatleri",
    subCategories: ["Farklı temalı iç tasarımlar"],
  },
  {
    name: "Digital",
    icon: "📁",
    description: "Dijital indirilebilir PDF pattern dosyaları",
    subCategories: [
      "Amigurumi Crochet Pattern PDF",
      "Knitted Clothing Pattern PDF",
      "Crochet Bag Pattern PDF",
    ],
  },
  {
    name: "Metal Wall Art",
    icon: "🖼️",
    description: "Metal kesim duvar dekorasyonu",
    subCategories: ["Metal Pano"],
  },
] as const;

export const ETSY_CURRENCIES = ["USD", "TRY"] as const;

/** Varsayılan üretim aralığı (saat) — eski EtsyFlow starter planıyla aynı. */
export const DEFAULT_INTERVAL_HOURS = 8;

export function findCatalogCategory(name: string): EtsyCatalogCategory | undefined {
  return ETSY_CATALOG.find((c) => c.name === name);
}

/** Kategori + alt kategori ikilisi katalogda birebir var mı? */
export function isValidCatalogPair(category: string, subCategory: string): boolean {
  return (findCatalogCategory(category)?.subCategories ?? []).includes(subCategory);
}
