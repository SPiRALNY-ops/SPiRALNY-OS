/**
 * JSON over HTTP for the connectors: timeouts, retries on rate limits and
 * server errors (honouring Retry-After), and errors that never echo secrets.
 * `fetch` is passed in so tests can replay recorded responses.
 */
export type Fetch = typeof fetch;

export class HttpError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`${service} returned HTTP ${status}${body ? `: ${body.slice(0, 300)}` : ""}`);
    this.name = "HttpError";
  }
}

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

export type RequestOptions = {
  service: string; // for error messages, e.g. "Search Console"
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  json?: unknown;
  form?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  /** Test hook: how long to wait before retry n (ms). */
  backoffMs?: (attempt: number, retryAfter: number | null) => number;
};

const defaultBackoff = (attempt: number, retryAfter: number | null) =>
  retryAfter !== null ? Math.min(retryAfter * 1000, 60_000) : Math.min(1000 * 2 ** attempt, 30_000);

export async function requestJson<T>(fetchFn: Fetch, url: string, opts: RequestOptions): Promise<T> {
  const { service, method = "GET", retries = 3, timeoutMs = 60_000, backoffMs = defaultBackoff } = opts;
  const headers: Record<string, string> = { accept: "application/json", ...opts.headers };
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(opts.json);
  } else if (opts.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.form).toString();
  }

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      if (attempt >= retries) throw new Error(`${service} could not be reached: ${(error as Error).message}`);
      await sleep(backoffMs(attempt, null));
      continue;
    }
    if (res.ok) {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }
    const text = await res.text().catch(() => "");
    if (RETRY_STATUS.has(res.status) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(backoffMs(attempt, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null));
      continue;
    }
    throw new HttpError(service, res.status, text);
  }
}

const sleep = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
