/**
 * Agent signup: get a Pedra API key for a person, with their say-so, without
 * having one yet. For agents with no browser in the loop (scripts, Claude
 * Code, a local MCP server).
 *
 *   1. `requestAccess({ email })` — Pedra emails the person a confirmation
 *      link (valid 30 min). A new account chooses a password there; an
 *      existing one just clicks "Allow". Nothing is created before the click.
 *   2. `waitForAccess(requestId)` — polls until they approve (→ `apiKey`),
 *      decline, or the link expires.
 *
 * Inbox confirmation is required, disposable email domains are refused, and
 * requests are rate-limited (HTTP 429, `code: "rate_limited"`).
 */
import { PedraError } from "./errors";
import { postJson, pick, resolveFetch, DEFAULT_BASE_URL, type HttpConfig } from "./http";
import type {
  AccessOptions,
  AccessRequestResponse,
  AccessStatusResponse,
  RequestAccessParams,
  WaitForAccessOptions,
} from "./types";

const DEFAULT_ACCESS_TIMEOUT = 30_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function httpConfig(options: AccessOptions = {}): HttpConfig {
  return {
    baseUrl: (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    timeout: options.timeout ?? DEFAULT_ACCESS_TIMEOUT,
    fetchImpl: resolveFetch(options.fetch),
  };
}

/**
 * Ask for an API key for `email`. Pedra emails the person a link to confirm
 * (new accounts set a password there). The response is the same whether or
 * not the address already has an account. Tell the person to check their
 * email, then call {@link waitForAccess} with the `requestId`.
 *
 * Throws `PedraApiError` with `status` 400 (invalid email, or
 * `code: "disposable_email"`), 429 (`code: "rate_limited"`) or 503
 * (`code: "unavailable"`).
 *
 * ```ts
 * import { requestAccess, waitForAccess, Pedra } from "@pedra-ai/sdk";
 * const { requestId } = await requestAccess({ email: "ana@agency.com", agentName: "My script" });
 * console.log("Check your email to confirm.");
 * const res = await waitForAccess(requestId);
 * if (res.status === "approved") new Pedra(res.apiKey);
 * ```
 */
export async function requestAccess(
  params: RequestAccessParams,
  options: AccessOptions = {},
): Promise<AccessRequestResponse> {
  if (!params || typeof params.email !== "string" || !params.email.trim()) {
    throw new PedraError("requestAccess: `email` is required");
  }
  const data = await postJson(httpConfig(options), "/agent_signup", {
    email: params.email,
    agentName: params.agentName,
  });
  return {
    requestId: pick(data, "requestId") ?? "",
    status: "pending",
    expiresAt: pick(data, "expiresAt"),
    pollAfterSeconds: pick(data, "pollAfterSeconds"),
    message: pick(data, "message"),
    raw: data,
  };
}

/**
 * Check an access request once: `pending`, `approved` (with `apiKey`),
 * `denied` or `expired`. After approval the key can be fetched for 15 min.
 * An unknown `requestId` throws `PedraApiError` (HTTP 404).
 */
export async function getAccessStatus(
  requestId: string,
  options: AccessOptions = {},
): Promise<AccessStatusResponse> {
  if (!requestId) throw new PedraError("getAccessStatus: `requestId` is required");
  const data = await postJson(httpConfig(options), "/agent_signup_status", { requestId });
  const status = pick(data, "status");
  if (status === "approved") {
    return {
      status: "approved",
      apiKey: pick(data, "apiKey") ?? "",
      email: pick(data, "email") ?? "",
      newAccount: Boolean(pick(data, "newAccount")),
      plan: pick(data, "plan") ?? "free",
      creditsRemaining: Number(pick(data, "creditsRemaining") ?? 0),
      appUrl: pick(data, "appUrl"),
      note: pick(data, "note"),
      raw: data,
    };
  }
  if (status === "denied" || status === "expired") return { status, raw: data };
  if (status === "pending") {
    return { status: "pending", pollAfterSeconds: pick(data, "pollAfterSeconds"), raw: data };
  }
  throw new PedraError(`Unexpected access status: ${JSON.stringify(status)}`);
}

/**
 * Poll {@link getAccessStatus} until the request is no longer pending and
 * return the result: `approved` (with `apiKey`), `denied` or `expired` — a
 * refusal resolves, it doesn't throw. Throws a `PedraError` if it's still
 * pending after `timeoutMs` (default 30 min, the confirmation link's lifetime).
 */
export async function waitForAccess(
  requestId: string,
  options: WaitForAccessOptions = {},
): Promise<AccessStatusResponse> {
  const intervalMs = options.intervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 30 * 60_000;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await getAccessStatus(requestId, options);
    if (res.status !== "pending") return res;
    if (Date.now() + intervalMs > deadline) {
      throw new PedraError(
        `Access request was still pending after ${timeoutMs}ms. Ask the person to open the link in their email.`,
      );
    }
    await sleep(intervalMs);
  }
}
