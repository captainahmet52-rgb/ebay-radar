// Nitelik (attribute) çıkarıcılar — "negatif token" vetosu için.
//
// İki başlık da AYNI niteliği belirtmiş ama DEĞER farklıysa → farklı ürün → VETO.
// (12V vs 20V, 50ft vs 100ft, 4 pack vs 24 pack...). Tek tarafta varsa veto YOK.
// Yanlış veto sadece "atla" demektir (kullanıcının 1 numaralı kuralı: yanlış
// eşleşmektense atla) — bu yüzden agresif olmak güvenli taraftır.

export interface ProductAttributes {
  voltage: number | null; // V
  amperage: number | null; // A / Ah
  wattage: number | null; // W
  lengthFt: number | null; // feet
  capacityMl: number | null; // ml (oz/L → ml'ye normalize)
}

function firstNumber(re: RegExp, text: string): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function extractAttributes(title: string): ProductAttributes {
  const t = title.toLowerCase();

  const voltage = firstNumber(/\b(\d{1,3}(?:\.\d)?)\s*v(?:olt|olts)?\b/, t);
  const amperage = firstNumber(/\b(\d{1,3}(?:\.\d)?)\s*a(?:h|mp|mps)?\b/, t);
  const wattage = firstNumber(/\b(\d{2,4})\s*w(?:att|atts)?\b/, t);
  const lengthFt = firstNumber(/\b(\d{1,3})\s*(?:ft|feet|foot)\b/, t);

  // Hacim → ml'ye normalize
  let capacityMl: number | null = null;
  const ml = firstNumber(/\b(\d{2,5})\s*ml\b/, t);
  const liter = firstNumber(/\b(\d{1,2}(?:\.\d)?)\s*l(?:iter|itre)?\b/, t);
  const ozFl = firstNumber(/\b(\d{1,3}(?:\.\d)?)\s*(?:fl\s*oz|oz)\b/, t);
  if (ml !== null) capacityMl = ml;
  else if (liter !== null) capacityMl = Math.round(liter * 1000);
  else if (ozFl !== null) capacityMl = Math.round(ozFl * 29.5735);

  return { voltage, amperage, wattage, lengthFt, capacityMl };
}

const ATTR_LABELS: Record<keyof ProductAttributes, string> = {
  voltage: "voltaj",
  amperage: "amper",
  wattage: "güç (W)",
  lengthFt: "uzunluk (ft)",
  capacityMl: "hacim",
};

// Hacim ölçümünde küçük tolerans (yuvarlama/birim çevriminden) — %5.
function valuesConflict(key: keyof ProductAttributes, a: number, b: number): boolean {
  if (key === "capacityMl") {
    const tol = Math.max(a, b) * 0.05;
    return Math.abs(a - b) > tol;
  }
  return a !== b;
}

/**
 * İki başlık arasında çelişen ilk niteliği döndürür (Türkçe etiket), yoksa null.
 * Yalnız İKİ tarafta da belirtilen nitelikleri karşılaştırır.
 */
export function attributeConflict(titleA: string, titleB: string): string | null {
  const a = extractAttributes(titleA);
  const b = extractAttributes(titleB);
  const keys = Object.keys(ATTR_LABELS) as (keyof ProductAttributes)[];
  for (const key of keys) {
    const va = a[key];
    const vb = b[key];
    if (va !== null && vb !== null && valuesConflict(key, va, vb)) {
      return ATTR_LABELS[key];
    }
  }
  return null;
}
