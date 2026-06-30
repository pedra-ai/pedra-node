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
  UpdateVideoParams,
  GenerateVoiceScriptParams,
  ScriptResponse,
  GenerateVoiceParams,
  VoiceResponse,
  MusicLibraryResponse,
  PropertiesResponse,
  ListPropertyImagesParams,
  PropertyImagesResponse,
  CreatePropertyParams,
  PropertyResponse,
  AddImagesToPropertyParams,
  AddImagesResponse,
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

  /**
   * Edit an existing video without re-rendering unchanged clips. Only new or
   * changed photos re-animate (and cost credits); reordering, music, voice,
   * branding and text re-stitch for free. Blocks server-side until the new
   * video is rendered and returns its URL. (`/update_video`)
   */
  async updateVideo(params: UpdateVideoParams): Promise<VideoResponse> {
    const data = await this.post("/update_video", params);
    return {
      message: pick(data, "message"),
      videoId: pick(data, "videoId") ?? params.videoId,
      videoUrl: pick(data, "videoUrl") ?? "",
      raw: data,
    };
  }

  /**
   * Generate a voiceover script from photos (and optional property facts).
   * GPT-4o vision reads the images so the script reflects what's shown. Feed
   * the result to {@link Pedra.generateVoice}. (`/generate_voice_script`)
   */
  async generateVoiceScript(
    params: GenerateVoiceScriptParams,
  ): Promise<ScriptResponse> {
    const data = await this.post("/generate_voice_script", params);
    return {
      message: pick(data, "message"),
      script: pick(data, "script") ?? "",
      raw: data,
    };
  }

  /**
   * Render a voiceover from a script via TTS. Returns an `audioId` to pass to a
   * video's `voice.audioId` (which also drives synced subtitles).
   * (`/generate_voice`)
   */
  async generateVoice(params: GenerateVoiceParams): Promise<VoiceResponse> {
    const data = await this.post("/generate_voice", params);
    return {
      message: pick(data, "message"),
      audioId: pick(data, "audioId") ?? "",
      audioUrl: pick(data, "audioUrl") ?? "",
      alignmentUrl: pick(data, "alignmentUrl"),
      duration: pick(data, "duration"),
      raw: data,
    };
  }

  /**
   * List the background-music catalog: the valid `music.track` values (genre
   * keys) and the voice languages. Read-only. (`/music_library`)
   */
  async musicLibrary(): Promise<MusicLibraryResponse> {
    const data = await this.post("/music_library", {});
    return {
      tracks: (pick(data, "tracks") ?? []) as MusicLibraryResponse["tracks"],
      variantsPerTrack: Number(pick(data, "variantsPerTrack") ?? 0),
      defaultTrack: pick(data, "defaultTrack") ?? "",
      voiceLanguages: (pick(data, "voiceLanguages") ?? []) as string[],
      raw: data,
    };
  }

  /**
   * List the account's properties (id, name, photo count, and a deep link to
   * open each in Pedra). Use it to find photos already in the account.
   * (`/list_properties`)
   */
  async listProperties(): Promise<PropertiesResponse> {
    const data = await this.post("/list_properties", {});
    return {
      properties: (pick(data, "properties") ?? []) as PropertiesResponse["properties"],
      raw: data,
    };
  }

  /**
   * List a property's photos as public URLs — ready to pass to
   * {@link Pedra.createVideo} or the image-editing methods. (`/list_property_images`)
   */
  async listPropertyImages(
    params: ListPropertyImagesParams,
  ): Promise<PropertyImagesResponse> {
    const data = await this.post("/list_property_images", params);
    return {
      propertyId: pick(data, "propertyId") ?? params.propertyId,
      name: pick(data, "name") ?? null,
      images: (pick(data, "images") ?? []) as PropertyImagesResponse["images"],
      raw: data,
    };
  }

  /**
   * Create a property. Returns its id and an `appUrl` to open it in Pedra (the
   * way to add brand-new local photos, which can't be sent through the API).
   * (`/create_property`)
   */
  async createProperty(params: CreatePropertyParams = {}): Promise<PropertyResponse> {
    const data = await this.post("/create_property", params);
    return {
      message: pick(data, "message"),
      propertyId: pick(data, "propertyId") ?? "",
      appUrl: pick(data, "appUrl"),
      raw: data,
    };
  }

  /**
   * Add photos to a property by URL — the server fetches and stores each one,
   * so any public https image URL works. (`/add_images_to_property`)
   */
  async addImagesToProperty(
    params: AddImagesToPropertyParams,
  ): Promise<AddImagesResponse> {
    const data = await this.post("/add_images_to_property", params);
    return {
      message: pick(data, "message"),
      propertyId: pick(data, "propertyId") ?? params.propertyId,
      added: (pick(data, "added") ?? []) as AddImagesResponse["added"],
      failed: (pick(data, "failed") ?? []) as AddImagesResponse["failed"],
      appUrl: pick(data, "appUrl"),
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
