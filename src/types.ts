/** Strength of the AI transformation. The API defaults to "Medium". */
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
  creativity?: Creativity;
}

export interface RenovationParams {
  imageUrl: string;
  style?: string;
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
  raw: unknown;
}

/** A project in the account's library. */
export interface PedraProject {
  projectId: string;
  name: string;
  createdAt?: string;
  /** Number of photos in the project. */
  photoCount?: number;
  /** Deep link that opens this project in the Pedra web app. */
  appUrl?: string;
}

/** Response from {@link Pedra.listProjects}. */
export interface ProjectsResponse {
  projects: PedraProject[];
  raw: unknown;
}

/** A photo in a project. */
export interface ProjectImage {
  imageId: string;
  /** Public URL — pass straight to {@link Pedra.createVideo} or the edit tools. */
  url: string;
  name?: string | null;
  aspectRatio?: number | null;
}

export interface ListProjectImagesParams {
  projectId: string;
}

/** Response from {@link Pedra.listProjectImages}. */
export interface ProjectImagesResponse {
  projectId: string;
  name?: string | null;
  images: ProjectImage[];
  raw: unknown;
}

export interface CreateProjectParams {
  /** Project name, e.g. the listing address. */
  name?: string;
}

/** Response from {@link Pedra.createProject}. */
export interface ProjectResponse {
  message?: string;
  projectId: string;
  /** Open this in the Pedra web app to upload local photos. */
  appUrl?: string;
  raw: unknown;
}

export interface AddImagesToProjectParams {
  projectId: string;
  /** Up to 20 image URLs. The server fetches and stores each one. */
  imageUrls: string[];
}

/** Response from {@link Pedra.addImagesToProject}. */
export interface AddImagesResponse {
  message?: string;
  projectId: string;
  added: Array<{ imageId: string; url: string; aspectRatio?: number }>;
  failed: Array<{ url: string; error: string }>;
  appUrl?: string;
  raw: unknown;
}
