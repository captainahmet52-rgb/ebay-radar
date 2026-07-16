// eBay REST API HTTP istemcisi
//
// Retry politikası:
//   429 / 5xx → exponential backoff + jitter, max 3 retry
//   401       → onRefresh callback varsa yeni token al, 1 kez retry et
//   diğer 4xx → retry yok, hemen fırlat
//
// Güvenlik: Authorization header / token string ASLA log'a veya hata
// mesajına yazılmaz.

const MAX_RETRIES = 3;

/** Exponential backoff + jitter — attempt 0,1,2 için ms bekleme süresi */
function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt + Math.random() * 500, 10000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EbayClient {
  private readonly baseUrl: string;
  private accessToken: string;
  private readonly onRefresh?: () => Promise<string>;

  constructor(
    accessToken: string,
    sandbox?: boolean,
    onRefresh?: () => Promise<string>
  ) {
    const useSandbox = sandbox ?? process.env.EBAY_SANDBOX === "true";
    this.baseUrl = useSandbox
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com";
    this.accessToken = accessToken;
    this.onRefresh = onRefresh;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;

    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(params);
      url = `${url}?${qs.toString()}`;
    }

    const serializedBody = body !== undefined ? JSON.stringify(body) : undefined;

    let attempt = 0;
    let refreshed = false;

    // attempt: backoff retry sayacı (429/5xx)
    // refreshed: 401 üzerine token yenileme bir kez denendi mi
    for (;;) {
      const init: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        // Askıda kalan bağlantı retry döngüsünü/worker slotunu süresiz kilitlemesin
        signal: AbortSignal.timeout(30_000),
      };

      if (serializedBody !== undefined) {
        init.body = serializedBody;
      }

      const response = await fetch(url, init);

      if (response.ok) {
        // 204 No Content
        if (response.status === 204) {
          return undefined as unknown as T;
        }
        return response.json() as Promise<T>;
      }

      const status = response.status;

      // 401 → token yenile, 1 kez retry
      if (status === 401 && this.onRefresh && !refreshed) {
        refreshed = true;
        this.accessToken = await this.onRefresh();
        continue;
      }

      // 429 / 5xx → backoff retry
      const retryable = status === 429 || status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }

      // Geriye kalan tüm durumlar → fırlat. Token/secret log'a yazılmaz.
      const errorBody = await this.safeErrorBody(response);
      throw new Error(
        `eBay API hatası [${method} ${path}]: ${status} ${response.statusText} — ${errorBody}`
      );
    }
  }

  /** Hata gövdesini güvenle oku — token sızıntısı riski olan header'lara dokunma */
  private async safeErrorBody(response: Response): Promise<string> {
    try {
      return JSON.stringify(await response.json());
    } catch {
      return await response.text().catch(() => "");
    }
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
