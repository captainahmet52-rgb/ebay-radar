// Ölçek güvenliği — "100.000 ürün aynı anda girerse ne olur" sorusunun cevabı.
//
// İki gerçek sınır vardır:
//   1) Postgres tek sorguda ~65535 bind parametresi kabul eder. `createMany` ve
//      `WHERE ... IN (...)` her satır/değer için parametre üretir; on binlerce
//      satırla tek çağrı → sorgu REDDEDİLİR (sessiz veri kaybı DEĞİL, sert hata).
//   2) `Promise.all(binlerce.map(dbYaz))` → Prisma bağlantı havuzu anında dolar,
//      istekler kuyruğa yığılır, timeout'a kadar birbirini bekler.
//
// Çözüm: her toplu işlem SABIT boyutlu parçalara bölünür (chunk) ve eş zamanlılık
// SINIRLANIR (runBatched). Girdi 10 de olsa 100.000 de olsa davranış aynı ve
// öngörülebilir kalır.

/** Güvenli createMany / IN(...) parça boyutu. ~50 kolonluk satırda bile
 *  50 × 1000 = 50.000 < 65535 parametre sınırı → tek chunk hiç aşmaz. */
export const DB_CHUNK = 1000;

/** Tek DB yazma partisinde eş zamanlı sorgu sayısı — bağlantı havuzunu boğmadan
 *  sıralıdan çok daha hızlı. Prisma varsayılan havuzu (~10-20) ile uyumlu. */
export const DB_CONCURRENCY = 25;

/** BullMQ addBulk parça boyutu — tek Redis çağrısında çok büyük payload/bellek
 *  sıçraması olmasın diye job'lar da parçalanır. */
export const QUEUE_CHUNK = 1000;

/** Diziyi en fazla `size` uzunluğunda parçalara böler. Girdi `size`'dan küçük/eşitse
 *  tek parça döner (davranış değişmez) → mevcut küçük yükler için sıfır etki. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error("chunk: size 0'dan büyük olmalı");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * items'ı `size` genişliğinde EŞ ZAMANLI partiler halinde işler: partiler SIRAYLA,
 * parti içi PARALEL. Sınırsız `Promise.all` gibi havuzu boğmaz; sıralı `for await`
 * gibi de yavaş değildir. Sonuçlar giriş sırasında döner.
 */
export async function runBatched<T, R>(
  items: readonly T[],
  size: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (size <= 0) throw new Error("runBatched: size 0'dan büyük olmalı");
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const part = items.slice(i, i + size);
    const settled = await Promise.all(part.map((item, j) => fn(item, i + j)));
    out.push(...settled);
  }
  return out;
}
