/** Strength of the AI transformation. The API defaults to "Medium". */
/** @deprecated `creativity` is ignored by the API since September 2026. */
export type Creativity = "Low" | "Medium" | "High";

/** Thumbs up/down vote. An empty string clears a previous vote. */
export type Vote = "up" | "down" | "positive" | "negative" | "";

/** Animation applied to an image in a video. */
export type VideoEffect = "zoom-in" | "zoom-out" | "transition" | "static";

/** Options for constructing a {@link Pedra} client. */
export interface ClientOptions {
  /** Your Pedra API key. Falls back to `process.env.PEDRA_API_KEY`. */
  apiKey?: string;
  /** Override the API base URL. Defaults to `https://app.pedra.ai/api`. */
  baseUrl?: string;
  /**
   * Per-request timeout in milliseconds. Defaults to 600000 (10 min) because
   * `createVideo` blocks server-side until the video is rendered.
   */
  timeout?: number;
  /** Custom fetch implementation (e.g. a polyfill on older runtimes). */
  fetch?: typeof fetch;
}

/** A single generated asset. */
export interface ImageOutput {
  url: string;
}

/**
 * Response from any image-generation endpoint. The raw API returns `output` as
 * either an array or a single object depending on the endpoint; this SDK
 * normalizes that into {@link ImageResponse.urls} / {@link ImageResponse.url}.
 */
export interface ImageResponse {
  /** Human-readable status message from the API, if any. */
  message?: string;
  /** All generated asset URLs (normalized across endpoints). */
  urls: string[];
  /** Convenience accessor for the first generated URL. */
  url?: string;
  /** The raw, unmodified JSON body returned by the API. */
  raw: unknown;
}

/** Response from {@link Pedra.createVideo}. */
export interface VideoResponse {
  message?: string;
  /** ID of the finished video asset. */
  videoId: string;
  /** Public URL of the finished video. */
  videoUrl: string;
  raw: unknown;
}

/** Response from {@link Pedra.credits}. */
export interface CreditsResponse {
  /** The account plan, e.g. "free" or a paid plan name. */
  plan: string;
  /** Credits remaining on the account. */
  creditsRemaining: number;
  raw: unknown;
}

/** Response from {@link Pedra.feedback}. The exact shape depends on the action. */
export interface FeedbackResponse {
  message?: string;
  /** True when a credit-back was granted for a thumbs-down. */
  creditedBack?: boolean;
  raw: unknown;
  [key: string]: unknown;
}

export interface EnhanceParams {
  /** URL or `data:` URL of the source image. */
  imageUrl: string;
  /**
   * When true, preserves the original framing/aspect ratio/resolution exactly
   * (uses nano-banana-2 instead of gpt-image). Intended for verification
   * verticals where the output must legally represent the captured photo.
   */
  preserveOriginalFraming?: boolean;
}

export interface EnhanceAndCorrectPerspectiveParams {
  imageUrl: string;
  preserveOriginalFraming?: boolean;
}

export interface EmptyParams {
  imageUrl: string;
}

export interface FurnishParams {
  imageUrl: string;
  /** e.g. "Living room", "Bedroom", "Kitchen". Auto-detected if omitted. */
  roomType?: string;
  /** e.g. "Minimalist", "Scandinavian", "Modern". */
  style?: string;
  /**
   * @deprecated Ignored by the API since September 2026 — there is one level, which keeps
   * walls, doors, windows and the camera angle. Accepted so existing code keeps working.
   */
  creativity?: Creativity;
}

export interface RenovationParams {
  imageUrl: string;
  style?: string;
  /**
   * @deprecated Ignored by the API since September 2026 — there is one level, which keeps
   * walls, doors, windows and the camera angle. Accepted so existing code keeps working.
   */
  creativity?: Creativity;
  /**
   * Whether the renovated room should be furnished. Accepts a boolean
   * (true → "With furniture", false → "Empty") or the explicit string.
   */
  furnish?: boolean | "With furniture" | "Empty" | "Auto";
  roomType?: string;
}

export interface EditViaPromptParams {
  imageUrl: string;
  /** Natural-language description of the edit to apply. */
  prompt: string;
}

export interface SkyParams {
  imageUrl: string;
  /** Optional named sky style to apply. */
  skyStyle?: string;
}

export interface RemoveParams {
  imageUrl: string;
  /** URL of the mask marking the region to remove. */
  maskUrl: string;
}

export interface BlurParams {
  imageUrl: string;
  /** Object labels/regions to blur (e.g. faces, license plates). */
  objectsToBlur: unknown;
}

export interface FeedbackParams {
  /** The generated image URL to vote on (id is parsed from it). */
  imageUrl?: string;
  /** Or the explicit image id. One of `imageUrl`/`imageId` is required. */
  imageId?: string;
  vote?: Vote;
  comment?: string;
  /** Request a credit refund (only honored on a thumbs-down). */
  creditBack?: boolean;
}

/** A single image in a {@link CreateVideoParams.images} list. */
export interface VideoImage {
  imageUrl: string;
  /** Defaults to "zoom-in". */
  effect?: VideoEffect;
  /** Required when `effect` is "transition". */
  secondImageUrl?: string;
  subtitle?: string;
  title?: string;
  watermark?: {
    enabled?: boolean;
    position?: string;
    opacity?: number;
  };
  characteristics?: {
    enabled?: boolean;
  };
}

/** Voiceover settings for a video. */
export interface VideoVoice {
  enabled?: boolean;
  /**
   * Id of a voiceover rendered with {@link Pedra.generateVoice}. This is the
   * handle the pipeline resolves to attach the narration (and its synced
   * subtitles). Prefer this over `audioUrl`.
   */
  audioId?: string;
  /** Legacy alias for `audioId`. */
  audioUrl?: string;
  /** Burn in word-synced subtitles from the voiceover. Defaults to true. */
  showSubtitles?: boolean;
}

export interface CreateVideoParams {
  images: VideoImage[];
  music?: { enabled?: boolean; track?: string };
  voice?: VideoVoice;
  branding?: { showWatermark?: boolean; showProfessionalPicture?: boolean };
  endingTitle?: string;
  endingSubtitle?: string;
  /** Force a vertical (9:16) video regardless of source aspect ratio. */
  isVertical?: boolean;
  propertyCharacteristics?: Array<{ label: string; value: string }>;
}

/**
 * Params for {@link Pedra.updateVideo}. Edits an existing video without
 * re-rendering unchanged clips — only new/changed photos re-animate (and cost
 * credits); reordering, music, voice, branding and text re-stitch for free.
 *
 * Every field except `videoId` is optional and patch-style: omit `images` to
 * change only audio/text/branding (the timeline is preserved), and omit
 * `music`/`voice`/`branding`/ending text to keep their current values.
 */
export interface UpdateVideoParams {
  /** Id of the video to edit (from {@link VideoResponse.videoId}). */
  videoId: string;
  /**
   * Full ordered image list to rebuild the timeline. A clip whose photo +
   * effect (+ second photo for transitions) matches an existing one is reused
   * as-is. Omit to keep the current timeline and edit only audio/text.
   */
  images?: VideoImage[];
  music?: { enabled?: boolean; track?: string };
  voice?: VideoVoice;
  branding?: { showWatermark?: boolean; showProfessionalPicture?: boolean };
  endingTitle?: string;
  endingSubtitle?: string;
  isVertical?: boolean;
  propertyCharacteristics?: Array<{ label: string; value: string }>;
}

/** Params for {@link Pedra.generateVoiceScript}. */
export interface GenerateVoiceScriptParams {
  /**
   * Photos to base the script on — URLs or `{ imageUrl }` objects. GPT-4o
   * vision reads them so the script reflects what's actually shown.
   */
  images?: Array<string | { imageUrl: string }>;
  /** Property facts to weave in (e.g. `[{ label: "Bedrooms", value: "3" }]`). */
  propertyCharacteristics?: Array<{ label: string; value: string }>;
  /** Script language, e.g. "English", "Español". Defaults to "English". */
  language?: string;
}

/** Response from {@link Pedra.generateVoiceScript}. */
export interface ScriptResponse {
  message?: string;
  /** The generated voiceover script text. */
  script: string;
  raw: unknown;
}

/** Params for {@link Pedra.generateVoice}. */
export interface GenerateVoiceParams {
  /** The script to narrate (max 1000 characters). */
  text: string;
  /** Voice language, e.g. "English", "Español". Defaults to "English". */
  language?: string;
  /**
   * Which voice narrates. See {@link Pedra.musicLibrary}'s `voicesByLanguage`
   * for the IDs offered for each language — a voice is only valid for the
   * language it's listed under. Defaults to that language's first voice.
   */
  voiceId?: string;
}

/** Response from {@link Pedra.generateVoice}. */
export interface VoiceResponse {
  message?: string;
  /** Pass this to a video's `voice.audioId` to attach the narration. */
  audioId: string;
  /** Public URL of the rendered mp3. */
  audioUrl: string;
  /** URL of the word-alignment JSON used for synced subtitles, if any. */
  alignmentUrl?: string;
  /** Approximate duration in seconds. */
  duration?: number;
  raw: unknown;
}

/** A background-music option for a video's `music.track`. */
export interface MusicTrack {
  track: string;
  label: string;
}

/** Response from {@link Pedra.musicLibrary}. */
export interface MusicLibraryResponse {
  /** Valid `music.track` values with display labels. */
  tracks: MusicTrack[];
  variantsPerTrack: number;
  defaultTrack: string;
  /** Languages accepted by {@link Pedra.generateVoice} / generateVoiceScript. */
  voiceLanguages: string[];
  /**
   * Valid `voiceId` values for {@link Pedra.generateVoice}, grouped by the
   * language they're offered for. Voices are native to their language, so a
   * voiceId is only accepted alongside the language it's listed under.
   */
  voicesByLanguage: LanguageVoices[];
  raw: unknown;
}

/** The voices offered for one language. */
export interface LanguageVoices {
  language: string;
  voices: VoiceOption[];
}

/** A selectable narration voice. */
export interface VoiceOption {
  voiceId: string;
  name: string;
  gender: string;
  /** The voice's native accent, e.g. "british". */
  accent: string;
  /** Character of the voice, e.g. "calm". */
  descriptor: string;
}

/** A property in the account's library. */
export interface PedraProperty {
  propertyId: string;
  name: string;
  createdAt?: string;
  /** Number of photos in the property. */
  photoCount?: number;
  /** Deep link that opens this property in the Pedra web app. */
  appUrl?: string;
}

/** Response from {@link Pedra.listProperties}. */
export interface PropertiesResponse {
  properties: PedraProperty[];
  raw: unknown;
}

/** A photo in a property. */
export interface PropertyImage {
  imageId: string;
  /** Public URL — pass straight to {@link Pedra.createVideo} or the edit tools. */
  url: string;
  name?: string | null;
  aspectRatio?: number | null;
}

/**
 * Which images of a property: regular photos (`"photo"`, the default) or 360°
 * photos (`"360"`, the equirectangular panoramas a virtual tour is built from).
 */
export type PropertyImageType = "photo" | "360";

export interface ListPropertyImagesParams {
  propertyId: string;
  /**
   * `"360"` lists the property's 360° photos instead of its regular photos.
   * Their `imageId`s are the scenes of a virtual tour. Defaults to `"photo"`.
   */
  type?: PropertyImageType;
}

/** Response from {@link Pedra.listPropertyImages}. */
export interface PropertyImagesResponse {
  propertyId: string;
  name?: string | null;
  images: PropertyImage[];
  raw: unknown;
}

export interface CreatePropertyParams {
  /** Property name, e.g. the listing address. */
  name?: string;
}

/** Response from {@link Pedra.createProperty}. */
export interface PropertyResponse {
  message?: string;
  propertyId: string;
  /** Open this in the Pedra web app to upload local photos. */
  appUrl?: string;
  raw: unknown;
}

export interface AddImagesToPropertyParams {
  propertyId: string;
  /**
   * Image URLs (or `data:` URIs) the server fetches and stores: up to 20
   * photos, or up to 10 when `type` is `"360"`.
   */
  imageUrls: string[];
  /**
   * `"360"` adds 360° photos: each is checked to be 2:1 equirectangular and
   * stored the way the Pedra app stores them, ready to become a virtual tour.
   * Defaults to `"photo"`.
   */
  type?: PropertyImageType;
}

/** Response from {@link Pedra.addImagesToProperty}. */
export interface AddImagesResponse {
  message?: string;
  propertyId: string;
  /** `"360"` when 360° photos were added. */
  type?: PropertyImageType;
  added: Array<{ imageId: string; url: string; aspectRatio?: number; path?: string }>;
  failed: Array<{ url: string; error: string; path?: string }>;
  appUrl?: string;
  raw: unknown;
}

// --- virtual tours -----------------------------------------------------------

/** Language of the tour page and of the AI room names. Defaults to `"en"`. */
export type TourLanguage = "en" | "es" | "fr" | "de" | "it" | "pt";

/**
 * How rooms get connected with navigation points:
 * - `"sequential"` (default): each room is linked to the next, both ways, in
 *   the order you pass them. Costs `max(3, ceil(rooms / 3))` credits.
 * - `"smart"`: AI compares every pair and links the rooms that visibly
 *   connect. Slower; up to 40 rooms; 5–160 credits by room count.
 * - `"none"`: free, no navigation points (place them with `updateVirtualTour`).
 */
export type TourLinking = "sequential" | "smart" | "none";

/** A tour is built in the background: poll until `"ready"` or `"failed"`. */
export type TourStatus = "processing" | "ready" | "failed";

/** One room of a tour to create or append. Pass exactly one of `imageUrl` / `imageId`. */
export interface TourSceneInput {
  /** A 360° photo (2:1 equirectangular): public https URL or `data:` URI. */
  imageUrl?: string;
  /** Id of a 360° photo already in the property (see `listPropertyImages({ type: "360" })`). */
  imageId?: string;
  /** Room name shown in the tour, e.g. "Kitchen". Omit and AI names the room. */
  name?: string;
}

export interface CreateVirtualTourParams {
  /**
   * The rooms in walking order (a plain string is treated as an `imageUrl`).
   * Omit, and pass `propertyId`, to use every 360° photo in that property in
   * upload order.
   */
  scenes?: Array<TourSceneInput | string>;
  /** Shorthand for `scenes: imageUrls.map((imageUrl) => ({ imageUrl }))`. */
  imageUrls?: string[];
  /** Property the tour belongs to. Omit to create a new property. One tour per property. */
  propertyId?: string;
  /** Tour title (also the new property's name), e.g. the listing address. */
  name?: string;
  /** Defaults to `"sequential"`. */
  linking?: TourLinking;
  language?: TourLanguage;
}

/** Build progress while `status` is `"processing"`. */
export interface TourProgress {
  stage: "queued" | "importing" | "naming" | "linking" | string;
  done?: number;
  total?: number;
}

/** A room of a tour. `sceneId` is the id of its 360° photo. */
export interface TourScene {
  sceneId: string;
  name: string | null;
  /** Stored photo URL (on a finished tour). */
  imageUrl?: string;
  /** Where the photo came from, on a create/append response: the URL, `"data: URI"` or `"property"`. */
  source?: string;
}

/** A one-direction navigation point from one room to another. */
export interface TourLink {
  linkId?: string | null;
  fromSceneId: string;
  toSceneId: string;
  /** Horizontal angle in the from-scene, −180..180 (0 = centre of the photo, negative = left). */
  yaw: number;
  /** Vertical angle, −90..90 (0 = horizon). */
  pitch?: number;
  aiGenerated?: boolean;
}

/** A scene that could not be imported. */
export interface FailedScene {
  index?: number;
  imageUrl?: string;
  error: string;
}

export interface TourSettings {
  navigationStyle: "white" | "blue";
  navigationSize: "small" | "medium" | "large";
  showLabels: boolean;
  language: TourLanguage;
}

/** A virtual tour, as returned by the tour endpoints. */
export interface VirtualTour {
  tourId: string;
  propertyId: string | null;
  name: string | null;
  status: TourStatus;
  /** Public, shareable tour page. */
  tourUrl: string;
  /** `<iframe>` snippet to embed the tour on a website. */
  embedCode: string;
  /** Opens the tour's property in the Pedra web app. */
  appUrl: string | null;
  /** `false` on the free plan: the tour builds, but its public link shows an upgrade page. */
  shareable: boolean;
  shareableNote?: string;
  sceneCount: number;
  linkCount: number;
  coverImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** Present while `status` is `"processing"`. */
  progress?: TourProgress;
  /** Why the build failed, when `status` is `"failed"`. Failed builds cost nothing. */
  error?: string;
  /** Why the last `addVirtualTourScenes` failed (the tour stays `"ready"`). */
  lastError?: string;
  failedScenes?: FailedScene[];
  /** Full detail (get / update / create responses). */
  scenes?: TourScene[];
  links?: TourLink[];
  settings?: TourSettings;
  raw: unknown;
}

/** Response from {@link Pedra.createVirtualTour} / {@link Pedra.addVirtualTourScenes}. */
export interface VirtualTourJobResponse extends VirtualTour {
  message?: string;
  linking?: TourLinking;
  /** Credits the linking step costs (charged only when linking starts). */
  creditsCost?: number;
  estimatedSeconds?: number;
  /** The appended rooms (addVirtualTourScenes only). */
  addedScenes?: TourScene[];
}

export interface ListVirtualToursParams {
  /** Only this property's tour. */
  propertyId?: string;
}

/** Response from {@link Pedra.listVirtualTours}: newest first, max 100, without scenes/links. */
export interface VirtualToursResponse {
  tours: Array<Omit<VirtualTour, "raw">>;
  raw: unknown;
}

/**
 * Params for {@link Pedra.updateVirtualTour}. Free and instant; validated all
 * or nothing. Every field except `tourId` is optional.
 */
export interface UpdateVirtualTourParams {
  tourId: string;
  /** New tour title. */
  name?: string;
  /** New room names, as `{ [sceneId]: "Kitchen" }`. */
  sceneNames?: Record<string, string>;
  /** Every sceneId exactly once, in the new order. The first one opens the tour. */
  sceneOrder?: string[];
  /** sceneIds to take out (the photos stay in the property; their links go too). */
  removeScenes?: string[];
  /** REPLACES all navigation links. Each is one direction; add the return link separately. */
  links?: Array<{ fromSceneId: string; toSceneId: string; yaw: number; pitch?: number }>;
  navigationStyle?: "white" | "blue";
  navigationSize?: "small" | "medium" | "large";
  /** Always show room names next to the navigation points. */
  showLabels?: boolean;
  language?: TourLanguage;
}

export interface AddVirtualTourScenesParams {
  tourId: string;
  /** The new rooms, in walking order. imageId scenes must be 360° photos in the tour's property. */
  scenes: Array<TourSceneInput | string>;
  /**
   * `"sequential"` (default) links only the new stretch: last existing room →
   * first new room, then each new room to the next. Costs
   * `max(3, ceil(newRooms / 3))` credits. `"none"` is free.
   */
  linking?: "sequential" | "none";
}

/** Response from {@link Pedra.deleteVirtualTour}. The 360° photos stay in the property. */
export interface DeleteVirtualTourResponse {
  message?: string;
  tourId: string;
  raw: unknown;
}

/**
 * What an upload link accepts. `"any"` (the default): regular photos and 360°
 * photos (2:1 images are detected and stored as 360° photos). `"360"`: only
 * 360° photos — use it for virtual tours.
 */
export type UploadLinkType = "any" | "360";

export interface CreateUploadLinkParams {
  /** Property to upload into. Omit to create a new one named `name`. */
  propertyId?: string;
  /** Name for the new property. Ignored when `propertyId` is given. */
  name?: string;
  /** What the page accepts. Defaults to `"any"`. */
  type?: UploadLinkType;
  /** Language of the upload page. */
  language?: TourLanguage;
}

/** Response from {@link Pedra.createUploadLink}. */
export interface UploadLinkResponse {
  message?: string;
  /** No-login page (phone or computer, 24 h) where someone drops photos into the property. */
  uploadUrl: string;
  propertyId: string;
  propertyName?: string;
  /** What the page accepts (`"any"` or `"360"`). */
  type?: UploadLinkType;
  expiresAt?: string;
  /** Most files one link takes (100). */
  maxFiles?: number;
  appUrl?: string;
  raw: unknown;
}

// --- agent signup (no API key needed) ----------------------------------------

/** Options for the signup functions, which run without an API key. */
export interface AccessOptions {
  /** Override the API base URL. Defaults to `https://app.pedra.ai/api`. */
  baseUrl?: string;
  /** Per-request timeout in ms. Defaults to 30000. */
  timeout?: number;
  /** Custom fetch implementation. */
  fetch?: typeof fetch;
}

export interface RequestAccessParams {
  /** The person's email. Pedra emails them a confirmation link (valid 30 min). */
  email: string;
  /** Shown to the person in the email and on the confirmation page, e.g. "Claude Code". */
  agentName?: string;
}

/** Response from {@link requestAccess}. */
export interface AccessRequestResponse {
  /** Pass to {@link getAccessStatus} / {@link waitForAccess}. Keep it private: it redeems the key. */
  requestId: string;
  status: "pending";
  expiresAt?: string;
  /** Suggested delay before the first status check (5). */
  pollAfterSeconds?: number;
  message?: string;
  raw: unknown;
}

export interface AccessPending {
  status: "pending";
  pollAfterSeconds?: number;
  raw: unknown;
}

export interface AccessApproved {
  status: "approved";
  /** The account's API key: pass it to `new Pedra(apiKey)` and store it. */
  apiKey: string;
  email: string;
  /** True when the account was created by this request. */
  newAccount: boolean;
  plan: string;
  creditsRemaining: number;
  appUrl?: string;
  /**
   * Present when the account has no credits left (new accounts start with
   * the free trial): the person can get credits with a plan.
   */
  note?: string;
  raw: unknown;
}

export interface AccessDenied {
  status: "denied";
  raw: unknown;
}

export interface AccessExpired {
  status: "expired";
  raw: unknown;
}

/** Response from {@link getAccessStatus}. Narrow on `status`. */
export type AccessStatusResponse =
  | AccessPending
  | AccessApproved
  | AccessDenied
  | AccessExpired;

export interface WaitForAccessOptions extends AccessOptions {
  /** Delay between polls in ms. Defaults to 5000. */
  intervalMs?: number;
  /** Give up (throw a `PedraError`) after this many ms. Defaults to 1800000 (30 min, the link's lifetime). */
  timeoutMs?: number;
}

export interface WaitForVirtualTourOptions {
  /** Delay between polls in ms. Defaults to 5000. */
  intervalMs?: number;
  /** Give up (throw a `PedraError`) after this many ms. Defaults to 900000 (15 min). */
  timeoutMs?: number;
}

export interface AddLocalPanoramasOptions {
  /**
   * Largest request body the helper builds, in bytes of base64 payload.
   * Defaults to 45 MB (the API accepts 50 MB bodies). A single file larger
   * than this once encoded (~33 MB on disk) is reported in `failed` — send it
   * with {@link Pedra.createUploadLink} instead.
   */
  maxRequestBytes?: number;
}
