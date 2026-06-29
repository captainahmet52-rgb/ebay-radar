// Ürün-tipi (head-noun) sözlüğü ve uyumluluk-bağlamı ayrıştırma.
//
// Radar eşleştirmesinin EN kritik hard kapısı: "adapter ≠ charger",
// "case for drill ≠ drill". Aksesuar/ana-ürün karışması en sinsi yanlış eşleşme.
// Burada YALNIZCA ürün tipi ÇELİŞİYORSA veto edilir; tip bulunamazsa veto YOK
// (çekimser duruş: eksik bilgi ≠ çatışma).

// Eş anlamlı ürün-tipi grupları. Aynı gruptaki kelimeler "aynı tip" sayılır.
// Yeni grup eklemek serbest; amaç yüksek HASSASİYET (yanlış eşleşmeyi kesmek),
// tam kapsama değil.
const PRODUCT_TYPE_GROUPS: readonly (readonly string[])[] = [
  ["wrench", "wrenches", "spanner", "spanners"],
  ["charger", "chargers", "charging"],
  ["adapter", "adapters", "adaptor", "adaptors"],
  ["cable", "cables", "cord", "cords", "wire", "wires"],
  ["battery", "batteries"],
  ["hose", "hoses"],
  ["case", "cases", "cover", "covers", "sleeve", "sleeves", "pouch", "skin"],
  ["screwdriver", "screwdrivers"],
  ["drill", "drills"],
  ["driver", "drivers", "impact"],
  ["saw", "saws", "blade", "blades"],
  ["light", "lights", "lamp", "lamps", "bulb", "bulbs", "headlight", "headlamp"],
  ["filter", "filters"],
  ["pump", "pumps"],
  ["fan", "fans"],
  ["motor", "motors"],
  ["headphone", "headphones", "earbud", "earbuds", "earphone", "earphones", "headset", "headsets"],
  ["speaker", "speakers", "soundbar"],
  ["keyboard", "keyboards"],
  ["mouse", "mice"],
  ["monitor", "monitors"],
  ["watch", "watches", "smartwatch"],
  ["band", "bands", "strap", "straps", "wristband"],
  ["shoe", "shoes", "sneaker", "sneakers", "boot", "boots"],
  ["shirt", "shirts", "tee", "tees", "tshirt"],
  ["jacket", "jackets", "coat", "coats", "hoodie", "hoodies"],
  ["pant", "pants", "trouser", "trousers", "jeans", "shorts"],
  ["glove", "gloves", "mitten", "mittens"],
  ["hat", "hats", "cap", "caps", "beanie"],
  ["bag", "bags", "backpack", "backpacks", "tote"],
  ["bottle", "bottles", "tumbler", "flask", "mug", "mugs", "cup", "cups"],
  ["knife", "knives", "blade"],
  ["pliers", "plier"],
  ["hammer", "hammers", "mallet"],
  ["tape", "tapes"],
  ["glue", "adhesive", "epoxy"],
  ["paint", "paints", "primer"],
  ["brush", "brushes"],
  ["sensor", "sensors"],
  ["switch", "switches", "relay", "relays"],
  ["valve", "valves"],
  ["bearing", "bearings"],
  ["belt", "belts"],
  ["gasket", "gaskets", "seal", "seals"],
  ["fitting", "fittings", "connector", "connectors", "coupler", "couplers"],
  ["mount", "mounts", "bracket", "brackets", "holder", "holders", "stand", "stands"],
  ["controller", "controllers", "gamepad", "joystick"],
  ["router", "routers", "modem"],
  ["camera", "cameras", "webcam", "webcams"],
  ["printer", "printers"],
  ["toner", "cartridge", "cartridges", "ink"],
  ["blender", "blenders", "mixer", "mixers"],
  ["toaster", "toasters"],
  ["kettle", "kettles"],
  ["heater", "heaters"],
  ["cooler", "coolers", "fridge", "refrigerator"],
  ["vacuum", "vacuums"],
  ["razor", "razors", "trimmer", "trimmers", "shaver", "shavers", "clipper", "clippers"],
  ["toothbrush", "toothbrushes"],
  ["diffuser", "diffusers", "humidifier", "humidifiers"],
  ["grinder", "grinders"],
  ["sander", "sanders"],
  ["compressor", "compressors"],
  ["generator", "generators"],
  ["inverter", "inverters"],
  ["tire", "tires", "tyre", "tyres", "wheel", "wheels"],
  ["mat", "mats", "rug", "rugs", "carpet"],
  ["pillow", "pillows", "cushion", "cushions"],
  ["blanket", "blankets", "quilt", "comforter"],
  ["towel", "towels"],
  ["sheet", "sheets", "bedding"],
  ["chair", "chairs", "stool", "stools"],
  ["desk", "desks", "table", "tables"],
  ["shelf", "shelves", "rack", "racks"],
];

// kelime → grup indeksi (tek seferlik kurulum)
const WORD_TO_GROUP: ReadonlyMap<string, number> = (() => {
  const m = new Map<string, number>();
  PRODUCT_TYPE_GROUPS.forEach((group, idx) => {
    for (const word of group) m.set(word, idx);
  });
  return m;
})();

// "for/fits/compatible with/replacement for ..." → bundan sonrası UYUMLULUK bağlamıdır.
// "Charger for Milwaukee M18" → ürün CHARGER'dır, marka Milwaukee DEĞİL.
const COMPAT_MARKERS = [
  "compatible with",
  "compatible for",
  "replacement for",
  "replacement",
  "fits for",
  "fits",
  "fit for",
  "works with",
  "designed for",
  "for use with",
  "for",
];

export interface CompatSplit {
  /** Uyumluluk işaretinden ÖNCEki kısım — ürünün kendi kimliği (tip + marka burada). */
  core: string;
  /** Uyumluluk işaretinden SONRAki kısım — uyumlu olduğu cihaz/marka (kanıt değil). */
  compat: string;
}

/** Başlığı "kendi kimliği" ve "uyumluluk bağlamı" olarak ikiye böler. */
export function splitCompat(title: string): CompatSplit {
  const lower = title.toLowerCase();
  let earliest = -1;
  let markerLen = 0;
  for (const marker of COMPAT_MARKERS) {
    // kelime sınırıyla ara (" for " gibi) — "form", "force" yanlış tetiklemesin
    const idx = lower.search(new RegExp(`\\b${marker.replace(/ /g, "\\s+")}\\b`));
    if (idx >= 0 && (earliest === -1 || idx < earliest)) {
      earliest = idx;
      markerLen = marker.length;
    }
  }
  if (earliest === -1) return { core: title, compat: "" };
  return {
    core: title.slice(0, earliest).trim(),
    compat: title.slice(earliest + markerLen).trim(),
  };
}

/** Başlıkta geçen ürün-tipi gruplarının indeks kümesi. */
export function extractTypeGroups(title: string): Set<number> {
  const out = new Set<number>();
  const words = title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/);
  for (const w of words) {
    const g = WORD_TO_GROUP.get(w);
    if (g !== undefined) out.add(g);
  }
  return out;
}

export type TypeAgreement = "agree" | "conflict" | "unknown";

/**
 * İki başlığın ÜRÜN TİPİ uyumu.
 * - agree   : ortak bir tip grubu var (ya da biri diğerini kapsıyor)
 * - conflict: iki tarafta da tip var ama HİÇ ortak yok → farklı ürün → VETO
 * - unknown : en az bir tarafta tanınan tip yok → veto YOK (çekimser)
 *
 * Önemli: tip tespiti, uyumluluk bağlamı ("for X") ATILDIKTAN sonra core üzerinden
 * yapılır ki "Charger for Drill" yanlışlıkla "drill" tipi sanılmasın.
 */
export function compareProductType(titleA: string, titleB: string): TypeAgreement {
  const a = extractTypeGroups(splitCompat(titleA).core);
  const b = extractTypeGroups(splitCompat(titleB).core);
  if (a.size === 0 || b.size === 0) return "unknown";
  for (const g of a) if (b.has(g)) return "agree";
  return "conflict";
}
