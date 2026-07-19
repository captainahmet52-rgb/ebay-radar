// Meta Graph API istemcisi — Shopify client.ts ile aynı ruh (retry, timeout).

const GRAPH_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_RETRIES = 3;

function backoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt + Math.random() * 500, 8000);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/** Genel Graph API çağrısı — GET/POST, form-encoded body, retry (429/5xx/rate limit). */
export async function metaGraph<T>(
  path: string,
  accessToken: string,
  options: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, string> } = {}
): Promise<T> {
  const method = options.method ?? "GET";
  const url = new URL(`${GRAPH_BASE}${path}`);

  let attempt = 0;
  for (;;) {
    let res: Response;
    if (method === "GET") {
      for (const [k, v] of Object.entries(options.params ?? {})) url.searchParams.set(k, v);
      url.searchParams.set("access_token", accessToken);
      res = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
    } else {
      const body = new URLSearchParams({ ...(options.params ?? {}), access_token: accessToken });
      res = await fetch(url.toString(), {
        method,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        signal: AbortSignal.timeout(30_000),
      });
    }

    const retryableHttp = res.status === 429 || res.status >= 500;
    if (retryableHttp && attempt < MAX_RETRIES) {
      await sleep(backoffMs(attempt));
      attempt += 1;
      continue;
    }

    const json = (await res.json().catch(() => ({}))) as T & GraphErrorBody;

    if (!res.ok) {
      // Meta rate-limit hataları code 4/17/32/613 ile gelir
      const code = json.error?.code;
      const rateLimited = code === 4 || code === 17 || code === 32 || code === 613;
      if (rateLimited && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        attempt += 1;
        continue;
      }
      throw new Error(`Meta API hatası: ${json.error?.message ?? res.status}`);
    }

    return json;
  }
}
