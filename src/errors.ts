/**
 * Base class for every error thrown by the SDK. Catch this to handle any
 * Pedra-originated failure (network, timeout, bad input, or API error).
 */
export class PedraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PedraError";
    // Restore the prototype chain (needed when targeting ES5/ES2020 with TS).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the API returns an error. `status` is the HTTP status code (note:
 * the Pedra API uses a heartbeat for long requests, so a generation that runs
 * long and then fails comes back as HTTP 200 with an `{ error }` body — in that
 * case `status` is 200 but the call still rejects with this error). `body` is
 * the parsed JSON response when available, and `code` its `code` field.
 */
export class PedraApiError extends PedraError {
  readonly status?: number;
  readonly body?: unknown;
  /**
   * Machine-readable error code from the response body, when the API sends
   * one: e.g. `"upload_limit"` / `"upload_link_limit"` (HTTP 429),
   * `"rate_limited"`, `"disposable_email"`, `"unavailable"`, `"tour_exists"`.
   */
  readonly code?: string;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "PedraApiError";
    this.status = status;
    this.body = body;
    const code =
      body && typeof body === "object" ? (body as { code?: unknown }).code : undefined;
    this.code = typeof code === "string" ? code : undefined;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
