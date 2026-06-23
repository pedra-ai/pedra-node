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
 * the parsed JSON response when available.
 */
export class PedraApiError extends PedraError {
  readonly status?: number;
  readonly body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "PedraApiError";
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
