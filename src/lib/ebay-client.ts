// eBay REST API HTTP istemcisi
export class EbayClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(accessToken: string, sandbox?: boolean) {
    const useSandbox = sandbox ?? process.env.EBAY_SANDBOX === "true";
    this.baseUrl = useSandbox
      ? "https://api.sandbox.ebay.com"
      : "https://api.ebay.com";
    this.accessToken = accessToken;
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

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);

    if (!response.ok) {
      let errorBody: string;
      try {
        errorBody = JSON.stringify(await response.json());
      } catch {
        errorBody = await response.text().catch(() => "");
      }
      throw new Error(
        `eBay API hatası [${method} ${path}]: ${response.status} ${response.statusText} — ${errorBody}`
      );
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
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
