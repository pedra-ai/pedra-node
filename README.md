# Pedra Node SDK

Official JavaScript / TypeScript SDK for the [Pedra API](https://pedra.ai/api-documentation) — AI photo editing for real estate: virtual staging, renovation, room emptying, image enhancement, sky replacement, object removal/blur, and property videos.

[![npm version](https://img.shields.io/npm/v/@pedra-ai/sdk.svg)](https://www.npmjs.com/package/@pedra-ai/sdk)

```bash
npm install @pedra-ai/sdk
```

Requires Node.js 18+ (uses the built-in `fetch`). Zero runtime dependencies.

## Quick start

```ts
import Pedra from "@pedra-ai/sdk";

const pedra = new Pedra("YOUR_API_KEY"); // or set PEDRA_API_KEY in the environment

const result = await pedra.furnish({
  imageUrl: "https://example.com/empty-living-room.jpg",
  roomType: "Living room",
  style: "Minimalist",
});

console.log(result.url);  // → the staged image URL
console.log(result.urls); // → all generated URLs
```

Get your API key from your [Pedra account settings](https://app.pedra.ai). Every method blocks until the asset is ready and returns the final URL(s) — there are no job IDs to poll. The API uses a heartbeat to keep long requests (like `createVideo`) alive.

### CommonJS

```js
const { Pedra } = require("@pedra-ai/sdk");
const pedra = new Pedra("YOUR_API_KEY");
```

## Authentication

Pass your key to the constructor, or set the `PEDRA_API_KEY` environment variable:

```ts
const pedra = new Pedra("YOUR_API_KEY");
// or
const pedra = new Pedra(); // reads process.env.PEDRA_API_KEY
```

Options:

```ts
const pedra = new Pedra("YOUR_API_KEY", {
  baseUrl: "https://app.pedra.ai/api", // default
  timeout: 600_000,                    // ms, default 10 min (covers createVideo)
});
```

## Responses

Image methods return a normalized shape regardless of how the underlying
endpoint formats its output:

```ts
interface ImageResponse {
  message?: string;
  urls: string[];     // every generated asset URL
  url?: string;       // convenience: the first URL
  raw: unknown;       // the untouched API response
}
```

## Methods

| Method | Endpoint | Returns |
| --- | --- | --- |
| `enhance({ imageUrl, preserveOriginalFraming? })` | `/enhance` | `ImageResponse` |
| `enhanceAndCorrectPerspective({ imageUrl, preserveOriginalFraming? })` | `/enhance_and_correct_perspective` | `ImageResponse` |
| `empty({ imageUrl })` | `/empty_room` | `ImageResponse` |
| `furnish({ imageUrl, roomType?, style?, creativity? })` | `/furnish` | `ImageResponse` |
| `renovation({ imageUrl, style?, creativity?, furnish?, roomType? })` | `/renovation` | `ImageResponse` |
| `editViaPrompt({ imageUrl, prompt })` | `/edit_via_prompt` | `ImageResponse` |
| `sky({ imageUrl, skyStyle? })` | `/sky_blue` | `ImageResponse` |
| `remove({ imageUrl, maskUrl })` | `/remove_object` | `ImageResponse` |
| `blur({ imageUrl, objectsToBlur })` | `/blur` | `ImageResponse` |
| `createVideo({ images, ... })` | `/create_video` | `VideoResponse` |
| `updateVideo({ videoId, ... })` | `/update_video` | `VideoResponse` |
| `generateVoiceScript({ images, ... })` | `/generate_voice_script` | `ScriptResponse` |
| `generateVoice({ text, ... })` | `/generate_voice` | `VoiceResponse` |
| `musicLibrary()` | `/music_library` | `MusicLibraryResponse` |
| `listProperties()` | `/list_properties` | `PropertiesResponse` |
| `listPropertyImages({ propertyId })` | `/list_property_images` | `PropertyImagesResponse` |
| `createProperty({ name? })` | `/create_property` | `PropertyResponse` |
| `addImagesToProperty({ propertyId, imageUrls })` | `/add_images_to_property` | `AddImagesResponse` |
| `credits()` | `/credits` | `CreditsResponse` |
| `feedback({ imageUrl \| imageId, vote, comment?, creditBack? })` | `/feedback` | `FeedbackResponse` |

### Examples

```ts
// Enhance — preserve exact framing (verification verticals)
await pedra.enhance({ imageUrl, preserveOriginalFraming: true });

// Empty a room
const { url } = await pedra.empty({ imageUrl });

// Renovate, furnished, high creativity
await pedra.renovation({ imageUrl, style: "Scandinavian", creativity: "High", furnish: true });

// Edit via prompt
await pedra.editViaPrompt({ imageUrl, prompt: "Add a large green plant in the corner" });

// Sky replacement
await pedra.sky({ imageUrl });

// Remove an object using a mask
await pedra.remove({ imageUrl, maskUrl });

// Blur faces / plates
await pedra.blur({ imageUrl, objectsToBlur: ["faces", "license_plates"] });

// Credits
const { plan, creditsRemaining } = await pedra.credits();

// Feedback + credit-back on a bad result
await pedra.feedback({ imageUrl, vote: "down", comment: "Artifacts on the wall", creditBack: true });
```

### Creating a video

`createVideo` blocks server-side (up to ~10 minutes) while the video renders,
then returns the finished URL inline:

```ts
const video = await pedra.createVideo({
  images: [
    { imageUrl: "https://example.com/photo1.jpg", effect: "zoom-in", title: "Living room" },
    { imageUrl: "https://example.com/photo2.jpg", effect: "zoom-out" },
    {
      imageUrl: "https://example.com/before.jpg",
      effect: "transition",
      secondImageUrl: "https://example.com/after.jpg",
    },
  ],
  music: { enabled: true, track: "calm" },
  branding: { showWatermark: true },
  endingTitle: "Contact us",
  endingSubtitle: "+1 555 0100",
  isVertical: false,
  propertyCharacteristics: [
    { label: "Bedrooms", value: "3" },
    { label: "Bathrooms", value: "2" },
  ],
});

console.log(video.videoUrl);
```

Per-image `effect` is one of `zoom-in` (default), `zoom-out`, `transition`
(requires `secondImageUrl`), or `static`. Each non-static image costs 5 credits.

## Error handling

```ts
import { PedraApiError, PedraError } from "@pedra-ai/sdk";

try {
  await pedra.enhance({ imageUrl });
} catch (err) {
  if (err instanceof PedraApiError) {
    console.error(err.status, err.message, err.body);
  } else if (err instanceof PedraError) {
    console.error("Client/network error:", err.message);
  }
}
```

`PedraApiError` is also thrown when a long request fails *after* the heartbeat
has started — the API returns HTTP 200 with an `{ error }` body in that case, and
the SDK surfaces it as an error anyway.

## Links

- API documentation: https://pedra.ai/api-documentation
- Pedra: https://pedra.ai

## License

MIT
