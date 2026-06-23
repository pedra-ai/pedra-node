import { PedraError, PedraApiError } from "./errors";
import type {
  ClientOptions,
  ImageResponse,
  VideoResponse,
  CreditsResponse,
  FeedbackResponse,
  EnhanceParams,
  EnhanceAndCorrectPerspectiveParams,
  EmptyParams,
  FurnishParams,
  RenovationParams,
  EditViaPromptParams,
  SkyParams,
  RemoveParams,
  BlurParams,
  FeedbackParams,
  CreateVideoParams,
} from "./types";

const DEFAULT_BASE_URL = "https://app.pedra.ai/api";
const DEFAULT_TIMEOUT = 600_000; // 10 min — createVideo blocks server-side until rendered.

/**
 * Client for the Pedra API. Every method is a single synchronous-style
 * `await` that blocks until the asset is ready and returns the final URL(s) —
 * there are no client-side job IDs to poll (the API keeps the connection alive
 * with a heartbeat).
 *
 * ```ts
 * import Pedra from "pedra";
 * const pedra = new Pedra("YOUR_API_KEY");
 * const { url } = await pedra.furnish({ imageUrl, roomType: "Living room", style: "Minimalist" });
 * ```
 */
export class Pedra {
  readonly baseUrl: string;
  readonly timeout: number;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(apiKey?: string | ClientOptions, options: ClientOptions = {}) {
    const opts: ClientOptions =
      typeof apiKey === "string" ? { ...options, apiKey } : { ...(apiKey ?? {}) };

    const key =
      opts.apiKey ??
      (typeof process !== "undefined" ? process.env?.PEDRA_API_KEY : undefined);
    if (!key) {
      throw new PedraError(
        "A Pedra API key is required. Pass it to `new Pedra(apiKey)` or set the PEDRA_API_KEY environment variable.",
      );
    }

    const fetchImpl = opts.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
      throw new PedraError(
        "global fetch is not available. Use Node 18+ or pass a `fetch` implementation via options.",
      );
    }

    this.apiKey = key;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.fetchImpl = fetchImpl;
  }

  /** Enhance an image (lighting, color, sharpness). */
  async enhance(params: EnhanceParams): Promise<ImageResponse> {
    return this.image(await this.post("/enhance", params));
  }

  /** Enhance an image and correct vertical/horizontal perspective. */
  async enhanceAndCorrectPerspective(
    params: EnhanceAndCorrectPerspectiveParams,
  ): Promise<ImageResponse> {
    return this.image(
      await this.post("/enhance_and_correct_perspective", params),
    );
  }

  /** Empty a room — remove all furniture and objects. (`/empty_room`) */
  async empty(params: EmptyParams): Promise<ImageResponse> {
    return this.image(await this.post("/empty_room", params));
  }

  /** Virtually stage / furnish a room. */
  async furnish(params: FurnishParams): Promise<ImageResponse> {
    return this.image(await this.post("/furnish", params));
  }

  /** Renovate a space (optionally furnished). */
  async renovation(params: RenovationParams): Promise<ImageResponse> {
    return this.image(await this.post("/renovation", params));
  }

  /** Edit an image from a natural-language prompt. (`/edit_via_prompt`) */
  async editViaPrompt(params: EditViaPromptParams): Promise<ImageResponse> {
    return this.image(await this.post("/edit_via_prompt", params));
  }

  /** Replace a dull/overcast sky with a clear blue one. (`/sky_blue`) */
  async sky(params: SkyParams): Promise<ImageResponse> {
    return this.image(await this.post("/sky_blue", params));
  }

  /** Remove an object using a mask. (`/remove_object`) */
  async remove(params: RemoveParams): Promise<ImageResponse> {
    return this.image(await this.post("/remove_object", params));
  }

  /** Blur objects (e.g. faces, license plates). */
  async blur(params: BlurParams): Promise<ImageResponse> {
    return this.image(await this.post("/blur", params));
  }

  /**
   * Create a property video from a list of images. Blocks server-side (up to
   * ~10 min) and returns the finished video URL inline. (`/create_video`)
   */
  async createVideo(params: CreateVideoParams): Promise<VideoResponse> {
    const data = await this.post("/create_video", params);
    return {
      message: pick(data, "message"),
      videoId: pick(data, "videoId") ?? "",
      videoUrl: pick(data, "videoUrl") ?? "",
      raw: data,
    };
  }

  /** Read the account's remaining credits and plan. Never deducts credits. */
  async credits(): Promise<CreditsResponse> {
    const data = await this.post("/credits", {});
    return {
      plan: pick(data, "plan") ?? "free",
      creditsRemaining: Number(pick(data, "creditsRemaining") ?? 0),
      raw: data,
    };
  }

  /**
   * Submit thumbs up/down feedback on a generated image, with an optional
   * credit-back on a thumbs-down (subject to the API's eligibility rules).
   */
  async feedback(params: FeedbackParams): Promise<FeedbackResponse> {
    const data = await this.post("/feedback", params);
    return { ...(data as object), raw: data } as FeedbackResponse;
  }

  // --- internals -----------------------------------------------------------

  private async post(path: string, body: object): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        // JSON.stringify drops `undefined` values, so optional params are omitted.
        body: JSON.stringify({ apiKey: this.apiKey, ...body }),
        signal: controller.signal,
      });
    } catch (err) {
      const e = err as { name?: string; message?: string };
      if (e?.name === "AbortError") {
        throw new PedraError(
          `Request to ${path} timed out after ${this.timeout}ms`,
        );
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
    if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
      throw new PedraApiError(
        String((data as { error: unknown }).error),
        res.status,
        data,
      );
    }

    if (data === undefined) {
      throw new PedraError(`Could not parse the response from ${path}`);
    }

    return data;
  }

  private image(data: unknown): ImageResponse {
    const output = pick(data, "output");
    let urls: string[] = [];
    if (Array.isArray(output)) {
      urls = output
        .map((o) => (o && typeof o === "object" ? (o as { url?: string }).url : undefined))
        .filter((u): u is string => typeof u === "string");
    } else if (output && typeof output === "object") {
      const u = (output as { url?: string }).url;
      if (typeof u === "string") urls = [u];
    }
    return {
      message: pick(data, "message") as string | undefined,
      urls,
      url: urls[0],
      raw: data,
    };
  }
}

function pick(obj: unknown, key: string): any {
  return obj && typeof obj === "object" ? (obj as Record<string, unknown>)[key] : undefined;
}
