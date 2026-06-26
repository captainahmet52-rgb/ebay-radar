// Paylaşılan SWR fetcher — non-2xx yanıtta THROW eder ki SWR'nin `error` durumu
// tetiklensin. Aksi halde 401/500'de hata gövdesi "veri" sanılıp sayfa boş/yanlış render olur.
//
// Dönüş tipi `any`: önceki satır-içi fetcher'lar da `res.json()` (Promise<any>) dönüyordu;
// useSWR çağrılarının çoğu tip parametresi vermeden `data?.x` erişiyor. Davranışı bire bir
// korumak için any döndürüyoruz (tipli güvende olmak isteyen çağrı `useSWR<T>(...)` yazabilir).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetcher(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `İstek başarısız (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // gövde JSON değil — varsayılan mesaj kalsın
    }
    throw new Error(message);
  }
  return res.json();
}
