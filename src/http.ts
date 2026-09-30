import { PedraError, PedraApiError } from "./errors";

export const DEFAULT_BASE_URL = "https://app.pedra.ai/api";

export interface HttpConfig {
  baseUrl: string;
  timeout: number;
  fetchImpl: typeof fetch;
}

/** Resolve the fetch implementation, or throw a clear error on old runtimes. */
export function resolveFetch(custom?: typeof fetch): typeof fetch {
  const fetchImpl = custom ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new PedraError(
      "global fetch is not available. Use Node 18+ or pass a `fetch` implementation via options.",
    );
  }
  return fetchImpl;
}

/**
 * POST a JSON body to the Pedra API and return the parsed response.
 *
 * `tourBody`: the response is a tour, whose `error` field is the reason a
 * build failed (HTTP 200, status "failed") — data, not a failed request.
 */
export async function postJson(
  config: HttpConfig,
  path: string,
  body: object,
  opts: { tourBody?: boolean } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);

  let res: Response;
  try {
    res = await config.fetchImpl(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // JSON.stringify drops `undefined` values, so optional params are omitted.
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e?.name === "AbortError") {
      throw new PedraError(`Request to ${path} timed out after ${config.timeout}ms`);
    }
    throw new PedraError(`Network error calling ${path}: ${e?.message ?? err}`);
  } finally {
    clearTimeout(timer);
  }

  // The heartbeat prefixes long responses with whitespace; JSON.parse tolerates it.
  const text = await res.text();
  let data: unknown;
  if (text && text.trim()) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const message =
      pick(data, "error") ??
      pick(data, "message") ??
      `Request to ${path} failed with status ${res.status}`;
    throw new PedraApiError(String(message), res.status, data);
  }

  // Heartbeat caveat: a request that runs long and then fails returns HTTP 200
  // with an `{ error }` body (the 200 header was already flushed). Catch it.
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    (data as { error?: unknown }).error &&
    !(opts.tourBody && "tourId" in data && "status" in data)
  ) {
    throw new PedraApiError(String((data as { error: unknown }).error), res.status, data);
  }

  if (data === undefined) {
    throw new PedraError(`Could not parse the response from ${path}`);
  }

  return data;
}

export function pick(obj: unknown, key: string): any {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}
