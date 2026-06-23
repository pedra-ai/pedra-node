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

export interface CreateVideoParams {
  images: VideoImage[];
  music?: { enabled?: boolean; track?: string };
  voice?: { enabled?: boolean; audioUrl?: string };
  branding?: { showWatermark?: boolean; showProfessionalPicture?: boolean };
  endingTitle?: string;
  endingSubtitle?: string;
  /** Force a vertical (9:16) video regardless of source aspect ratio. */
  isVertical?: boolean;
  propertyCharacteristics?: Array<{ label: string; value: string }>;
}
