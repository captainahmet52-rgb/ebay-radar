/**
 * TrackCaptain API istemcisi.
 * Amazon TBA gibi eBay'in tanımadığı numaralar yerine, varış adresine uyan
 * GERÇEK USPS/FedEx takip numarası sağlar (eBay her zaman kabul eder).
 *
 * Model: sahibin TEK TrackCaptain hesabı + kredisi vardır; sistem tüm müşteriler
 * için o krediden numara claim eder (1 kredi/claim). Müşteriden ayrıca cüzdanından
 * $0.43 düşülür (kâr marjı). Anahtar: env TRACKCAPTAIN_API_KEY (Bearer).
 *
 * Docs: https://trackcaptain.com/api/v1  (Bearer tc_live_...)
 */

const BASE_URL = "https://trackcaptain.com/api/v1";

export interface TrackCaptainDestination {
  city?: string;
  state?: string;
  zip?: string;
  country?: string;        // varsayılan US
  deliveryDate?: string;   // ISO tarih (YYYY-MM-DD)
  radius?: 25 | 50 | 100;
}

export interface ClaimedTracking {
  id: number;
  trackingNumber: string;
  carrier: string;
  destinationZip?: string;
  deliveryDate?: string;
}

export interface TrackCaptainAccount {
  creditBalance: number;
}

/** Sahibin TrackCaptain kredisi bittiğinde fırlatılır (HTTP 402). KRİTİK. */
export class TrackCaptainOutOfCreditsError extends Error {
  constructor(public creditBalance = 0) {
    super("TrackCaptain kredisi yetersiz (sahibin hesabı). Kredi yüklenmeli.");
    this.name = "TrackCaptainOutOfCreditsError";
  }
}

export function isTrackCaptainConfigured(): boolean {
  return Boolean(process.env.TRACKCAPTAIN_API_KEY);
}

function authHeaders(): Record<string, string> {
  const key = process.env.TRACKCAPTAIN_API_KEY;
  if (!key) throw new Error("TRACKCAPTAIN_API_KEY tanımlı değil");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

interface ApiError {
  error?: string;
  credit_balance?: number;
}

/** Sahibin güncel TrackCaptain kredi bakiyesini döndürür (ücretsiz endpoint). */
export async function getTrackCaptainAccount(): Promise<TrackCaptainAccount> {
  const res = await fetch(`${BASE_URL}/account`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(`TrackCaptain /account hatası: ${res.status} — ${body.error ?? ""}`);
  }
  const data = (await res.json()) as { credit_balance?: number };
  return { creditBalance: data.credit_balance ?? 0 };
}

interface ClaimResponse {
  id: number;
  tracking_number: string;
  carrier: string;
  destination_zip?: string;
  delivery_date?: string;
}

/**
 * Tek seferde varış kriterine uyan bir numara bulur ve claim eder (1 kredi).
 * Token/secret loglanmaz. Hata kodları docs'a göre map'lenir.
 */
export async function matchAndClaim(
  dest: TrackCaptainDestination = {}
): Promise<ClaimedTracking> {
  const body: Record<string, unknown> = { country: dest.country ?? "US" };
  if (dest.city) body.city = dest.city;
  if (dest.state) body.state = dest.state;
  if (dest.zip) body.zip = dest.zip;
  if (dest.deliveryDate) body.delivery_date = dest.deliveryDate;
  if (dest.radius) body.radius = dest.radius;

  const res = await fetch(`${BASE_URL}/tracking/match-and-claim`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 402) {
    const b = (await res.json().catch(() => ({}))) as ApiError;
    throw new TrackCaptainOutOfCreditsError(b.credit_balance ?? 0);
  }
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as ApiError;
    // 409 = başkası claim etti, 422 = numara çok eski, vb.
    throw new Error(`TrackCaptain claim hatası: ${res.status} — ${b.error ?? ""}`);
  }

  const data = (await res.json()) as ClaimResponse;
  return {
    id: data.id,
    trackingNumber: data.tracking_number,
    carrier: data.carrier,
    destinationZip: data.destination_zip,
    deliveryDate: data.delivery_date,
  };
}
