import { PedraError } from "./errors";
import { postJson, pick, resolveFetch, DEFAULT_BASE_URL } from "./http";
import {
  requestAccess,
  getAccessStatus,
  waitForAccess,
} from "./access";
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
  CreateVirtualTourParams,
  VirtualTour,
  VirtualTourJobResponse,
  ListVirtualToursParams,
  VirtualToursResponse,
  UpdateVirtualTourParams,
  AddVirtualTourScenesParams,
  DeleteVirtualTourResponse,
  CreateUploadLinkParams,
  UploadLinkResponse,
  WaitForVirtualTourOptions,
  AddLocalPanoramasOptions,
} from "./types";

const DEFAULT_TIMEOUT = 600_000; // 10 min — createVideo blocks server-side until rendered.

// addImagesToProperty with type "360" takes at most 10 per call, and the API
// parses bodies up to 50 MB; stay under it with room for the JSON around it.
const MAX_PANORAMAS_PER_CALL = 10;
const DEFAULT_MAX_REQUEST_BYTES = 45 * 1024 * 1024;
const PANORAMA_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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

  /**
   * Agent signup, no API key needed: email the person a link to confirm (new
   * accounts set a password there). See {@link requestAccess}.
   */
  static requestAccess = requestAccess;
  /** Check an access request once. See {@link getAccessStatus}. */
  static getAccessStatus = getAccessStatus;
  /** Poll an access request until approved, denied or expired. See {@link waitForAccess}. */
  static waitForAccess = waitForAccess;

  constructor(apiKey?: string | ClientOptions, options: ClientOptions = {}) {
    const opts: ClientOptions =
      typeof apiKey === "string" ? { ...options, apiKey } : { ...(apiKey ?? {}) };

    const key =
      opts.apiKey ??
      (typeof process !== "undefined" ? process.env?.PEDRA_API_KEY : undefined);
    if (!key) {
      throw new PedraError(
        "A Pedra API key is required. Pass it to `new Pedra(apiKey)` or set the PEDRA_API_KEY environment variable. " +
          "No account yet? Get a key with `Pedra.requestAccess({ email })` (the person confirms by email).",
      );
    }

    const fetchImpl = resolveFetch(opts.fetch);

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
      voicesByLanguage: (pick(data, "voicesByLanguage") ??
        []) as MusicLibraryResponse["voicesByLanguage"],
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
   * {@link Pedra.createVideo} or the image-editing methods. Pass
   * `type: "360"` to list its 360° photos instead (their `imageId`s are the
   * scenes of a virtual tour). (`/list_property_images`)
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
   * so any public https image URL (or `data:` URI) works. Pass `type: "360"`
   * for 360° photos (max 10 per call), which can then become a virtual tour.
   * For 360° files on disk, see {@link Pedra.addLocalPanoramas}.
   * Every stored image counts toward the daily upload limit (30 free, 500
   * paid, reset at midnight UTC); over it the whole call is refused with
   * `PedraApiError` status 429, `code: "upload_limit"`.
   * (`/add_images_to_property`)
   */
  async addImagesToProperty(
    params: AddImagesToPropertyParams,
  ): Promise<AddImagesResponse> {
    const data = await this.post("/add_images_to_property", params);
    return {
      message: pick(data, "message"),
      propertyId: pick(data, "propertyId") ?? params.propertyId,
      type: pick(data, "type"),
      added: (pick(data, "added") ?? []) as AddImagesResponse["added"],
      failed: (pick(data, "failed") ?? []) as AddImagesResponse["failed"],
      appUrl: pick(data, "appUrl"),
      raw: data,
    };
  }

  /**
   * Upload 360° photo files from local disk into a property (Node only). Each
   * file is base64-encoded into a `data:` URI and sent with
   * {@link Pedra.addImagesToProperty} (`type: "360"`), in order, in batches that
   * respect the API's 10-per-call and 50 MB body limits. Files are added in
   * the order given, which is the order `createVirtualTour({ propertyId })`
   * uses for the rooms.
   *
   * Files that can't be sent (missing, not JPEG/PNG/WebP, or too large to send
   * inline) and photos the API rejects (e.g. not 2:1) are reported in
   * `failed` rather than thrown. For files over ~33 MB, use
   * {@link Pedra.createUploadLink}.
   */
  async addLocalPanoramas(
    propertyId: string,
    paths: string[],
    options: AddLocalPanoramasOptions = {},
  ): Promise<AddImagesResponse> {
    if (!propertyId) throw new PedraError("addLocalPanoramas: propertyId is required");
    if (!Array.isArray(paths) || paths.length === 0) {
      throw new PedraError("addLocalPanoramas: pass at least one file path");
    }
    const fs = await import("fs/promises");
    const pathMod = await import("path");
    const maxBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;

    const added: AddImagesResponse["added"] = [];
    const failed: AddImagesResponse["failed"] = [];
    let appUrl: string | undefined;

    // Plan batches from file sizes, so only one batch is held in memory.
    type Planned = { path: string; mime: string; encodedBytes: number };
    const batches: Planned[][] = [];
    let current: Planned[] = [];
    let currentBytes = 0;
    for (const path of paths) {
      const ext = pathMod.extname(path).toLowerCase();
      const mime = PANORAMA_MIME_BY_EXT[ext];
      if (!mime) {
        failed.push({
          url: path,
          path,
          error: `Unsupported file type "${ext || "(none)"}": a 360° photo must be JPEG, PNG or WebP`,
        });
        continue;
      }
      let size: number;
      try {
        size = (await fs.stat(path)).size;
      } catch (err) {
        failed.push({ url: path, path, error: `Could not read file: ${(err as Error).message}` });
        continue;
      }
      const encodedBytes = `data:${mime};base64,`.length + Math.ceil(size / 3) * 4;
      if (encodedBytes > maxBytes) {
        failed.push({
          url: path,
          path,
          error:
            `File is ${(size / 1024 / 1024).toFixed(1)} MB, too large to send inline ` +
            `(limit ~${Math.floor(((maxBytes * 3) / 4) / 1024 / 1024)} MB). ` +
            `Use createUploadLink() and upload it on that page instead.`,
        });
        continue;
      }
      if (
        current.length >= MAX_PANORAMAS_PER_CALL ||
        (current.length > 0 && currentBytes + encodedBytes > maxBytes)
      ) {
        batches.push(current);
        current = [];
        currentBytes = 0;
      }
      current.push({ path, mime, encodedBytes });
      currentBytes += encodedBytes;
    }
    if (current.length) batches.push(current);

    // Sequential calls keep the upload order across batches.
    for (const batch of batches) {
      const imageUrls: string[] = [];
      const sent: Planned[] = [];
      for (const f of batch) {
        try {
          const bytes = await fs.readFile(f.path);
          imageUrls.push(`data:${f.mime};base64,${bytes.toString("base64")}`);
          sent.push(f);
        } catch (err) {
          failed.push({ url: f.path, path: f.path, error: `Could not read file: ${(err as Error).message}` });
        }
      }
      if (!imageUrls.length) continue;
      const res = await this.addImagesToProperty({ propertyId, imageUrls, type: "360" });
      appUrl = res.appUrl ?? appUrl;
      // The API reports added/failed in input order but separately, so a file
      // is only matched to its result when the batch didn't mix the two.
      const exact = res.failed.length === 0 || res.added.length === 0;
      res.added.forEach((a, i) => added.push(exact ? { ...a, path: sent[i]?.path } : a));
      res.failed.forEach((f, i) =>
        failed.push(
          exact
            ? { ...f, url: sent[i]?.path ?? f.url, path: sent[i]?.path }
            : { ...f, url: `one of: ${sent.map((s) => s.path).join(", ")}` },
        ),
      );
    }

    return {
      message: `Added ${added.length} 360° photo(s)` + (failed.length ? `, ${failed.length} failed` : ""),
      propertyId,
      type: "360",
      added,
      failed,
      appUrl,
      raw: undefined,
    };
  }

  /**
   * Build a hosted 360° virtual tour. AI names the rooms and places the
   * door-to-door navigation points. Returns immediately with
   * `status: "processing"` — poll {@link Pedra.getVirtualTour} or use
   * {@link Pedra.waitForVirtualTour}. One tour per property.
   * (`/create_virtual_tour`)
   */
  async createVirtualTour(
    params: CreateVirtualTourParams,
  ): Promise<VirtualTourJobResponse> {
    const data = await this.post("/create_virtual_tour", params, { tourBody: true });
    return this.tour(data) as VirtualTourJobResponse;
  }

  /**
   * Get a virtual tour: status (`processing` / `ready` / `failed`, with the
   * reason in `error`), share link, embed code, scenes and links.
   * A failed build resolves (it doesn't throw) — check `status`.
   * (`/get_virtual_tour`)
   */
  async getVirtualTour(tourId: string): Promise<VirtualTour> {
    return this.tour(await this.post("/get_virtual_tour", { tourId }, { tourBody: true }));
  }

  /**
   * List the account's virtual tours, newest first (max 100), optionally only
   * one property's. (`/list_virtual_tours`)
   */
  async listVirtualTours(
    params: ListVirtualToursParams = {},
  ): Promise<VirtualToursResponse> {
    const data = await this.post("/list_virtual_tours", params);
    return {
      tours: (pick(data, "tours") ?? []) as VirtualToursResponse["tours"],
      raw: data,
    };
  }

  /**
   * Change a tour in place: rename it or its rooms, reorder or remove rooms,
   * replace its navigation links, or restyle the navigation points. Free and
   * instant; returns the full updated tour. (`/update_virtual_tour`)
   */
  async updateVirtualTour(params: UpdateVirtualTourParams): Promise<VirtualTour> {
    return this.tour(await this.post("/update_virtual_tour", params, { tourBody: true }));
  }

  /**
   * Append rooms to a tour. Asynchronous like create: the tour stays live, and
   * you poll until it's `"ready"` again (a failed append leaves the tour as it
   * was, with `lastError`). (`/add_virtual_tour_scenes`)
   */
  async addVirtualTourScenes(
    params: AddVirtualTourScenesParams,
  ): Promise<VirtualTourJobResponse> {
    const data = await this.post("/add_virtual_tour_scenes", params, { tourBody: true });
    return this.tour(data) as VirtualTourJobResponse;
  }

  /**
   * Delete a tour. Its public link then returns 404; its 360° photos stay in
   * the property. (`/delete_virtual_tour`)
   */
  async deleteVirtualTour(tourId: string): Promise<DeleteVirtualTourResponse> {
    const data = await this.post("/delete_virtual_tour", { tourId });
    return {
      message: pick(data, "message"),
      tourId: pick(data, "tourId") ?? tourId,
      raw: data,
    };
  }

  /**
   * Get a no-login upload page (phone or computer, valid 24 h, up to 100
   * files) where someone drops photos into a property. `type: "any"` (the
   * default) takes regular photos and 360° photos (2:1 images are stored as
   * 360° photos automatically); `type: "360"` takes only 360° photos — use it
   * for a virtual tour. When they're done, list them with
   * `listPropertyImages({ propertyId })` (`type: "360"` for 360° photos) or
   * call `createVirtualTour({ propertyId })`. Creates the property if no
   * `propertyId` is given. Over the daily link limit (5 free, 50 paid) this
   * throws `PedraApiError` with status 429 and `code: "upload_link_limit"`.
   * (`/create_upload_link`)
   */
  async createUploadLink(
    params: CreateUploadLinkParams = {},
  ): Promise<UploadLinkResponse> {
    const data = await this.post("/create_upload_link", params);
    return {
      message: pick(data, "message"),
      uploadUrl: pick(data, "uploadUrl") ?? "",
      propertyId: pick(data, "propertyId") ?? params.propertyId ?? "",
      propertyName: pick(data, "propertyName"),
      type: pick(data, "type") ?? params.type,
      expiresAt: pick(data, "expiresAt"),
      maxFiles: pick(data, "maxFiles"),
      appUrl: pick(data, "appUrl"),
      raw: data,
    };
  }

  /**
   * Poll {@link Pedra.getVirtualTour} until the tour is `"ready"` or
   * `"failed"`, and return it (a failed tour is returned, not thrown — check
   * `status` and `error`). Throws a `PedraError` if it's still processing
   * after `timeoutMs`.
   *
   * ```ts
   * const { tourId } = await pedra.createVirtualTour({ imageUrls });
   * const tour = await pedra.waitForVirtualTour(tourId);
   * if (tour.status === "ready") console.log(tour.tourUrl);
   * ```
   */
  async waitForVirtualTour(
    tourId: string,
    options: WaitForVirtualTourOptions = {},
  ): Promise<VirtualTour> {
    const intervalMs = options.intervalMs ?? 5_000;
    const timeoutMs = options.timeoutMs ?? 900_000;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const tour = await this.getVirtualTour(tourId);
      if (tour.status === "ready" || tour.status === "failed") return tour;
      if (Date.now() + intervalMs > deadline) {
        throw new PedraError(
          `Virtual tour ${tourId} was still ${tour.status} after ${timeoutMs}ms`,
        );
      }
      await sleep(intervalMs);
    }
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

  /**
   * `tourBody`: the response is a tour, whose `error` field is the reason a
   * build failed (HTTP 200, status "failed") — data, not a failed request.
   */
  private post(
    path: string,
    body: object,
    opts: { tourBody?: boolean } = {},
  ): Promise<unknown> {
    return postJson(
      { baseUrl: this.baseUrl, timeout: this.timeout, fetchImpl: this.fetchImpl },
      path,
      // JSON.stringify drops `undefined` values, so optional params are omitted.
      { apiKey: this.apiKey, ...body },
      opts,
    );
  }

  private tour(data: unknown): VirtualTour {
    return { ...(data as object), raw: data } as VirtualTour;
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
