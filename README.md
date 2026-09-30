# Pedra Node SDK

Official JavaScript / TypeScript SDK for the [Pedra API](https://pedra.ai/api-documentation) — AI photo editing for real estate: virtual staging, renovation, room emptying, image enhancement, sky replacement, object removal/blur, property videos, and hosted 360° virtual tours.

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

Get your API key from your [Pedra account settings](https://app.pedra.ai). Every photo and video method blocks until the asset is ready and returns the final URL(s) — there are no job IDs to poll. The API uses a heartbeat to keep long requests (like `createVideo`) alive. [Virtual tours](#virtual-tours) are the exception: they build in the background and you poll for them.

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

### No Pedra account yet?

An agent or script can get a key for a person without a browser in the loop.
Pedra emails them a confirmation link (valid 30 min): a new account chooses a
password there, an existing one just clicks "Allow". Nothing is created until
they click, and they can decline. No API key is needed for these calls:

```ts
import { Pedra, requestAccess, waitForAccess } from "@pedra-ai/sdk";

const { requestId } = await requestAccess({ email: "ana@agency.com", agentName: "My listing script" });
console.log("Check your email and confirm to give this script access to Pedra.");

const res = await waitForAccess(requestId); // polls every 5 s, up to 30 min
if (res.status === "approved") {
  // Store res.apiKey somewhere safe (it can be fetched for 15 min after approval).
  const pedra = new Pedra(res.apiKey);
  if (res.note) console.log(res.note); // e.g. a new free account unlocks its trial at app.pedra.ai
} else {
  console.log(`Access ${res.status}`); // "denied" or "expired"
}
```

`Pedra.requestAccess` / `Pedra.getAccessStatus` / `Pedra.waitForAccess` are the
same functions. The response is the same whether or not the address already has
an account. Inbox confirmation is required, disposable email domains are
refused (400, `code: "disposable_email"`), and requests are rate-limited (429,
`code: "rate_limited"`).

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
| `furnish({ imageUrl, roomType?, style? })` | `/furnish` | `ImageResponse` |
| `renovation({ imageUrl, style?, furnish?, roomType? })` | `/renovation` | `ImageResponse` |
| `editViaPrompt({ imageUrl, prompt })` | `/edit_via_prompt` | `ImageResponse` |
| `sky({ imageUrl, skyStyle? })` | `/sky_blue` | `ImageResponse` |
| `remove({ imageUrl, maskUrl })` | `/remove_object` | `ImageResponse` |
| `blur({ imageUrl, objectsToBlur })` | `/blur` | `ImageResponse` |
| `createVideo({ images, ... })` | `/create_video` | `VideoResponse` |
| `updateVideo({ videoId, ... })` | `/update_video` | `VideoResponse` |
| `generateVoiceScript({ images, ... })` | `/generate_voice_script` | `ScriptResponse` |
| `generateVoice({ text, ... })` | `/generate_voice` | `VoiceResponse` |
| `musicLibrary()` | `/music_library` | `MusicLibraryResponse` (tracks, voice languages, voices) |
| `listProperties()` | `/list_properties` | `PropertiesResponse` |
| `listPropertyImages({ propertyId, type? })` | `/list_property_images` | `PropertyImagesResponse` |
| `createProperty({ name? })` | `/create_property` | `PropertyResponse` |
| `addImagesToProperty({ propertyId, imageUrls, type? })` | `/add_images_to_property` | `AddImagesResponse` |
| `addLocalPanoramas(propertyId, paths, options?)` | `/add_images_to_property` (batched) | `AddImagesResponse` |
| `createVirtualTour({ scenes \| imageUrls \| propertyId, name?, linking?, language? })` | `/create_virtual_tour` | `VirtualTourJobResponse` |
| `getVirtualTour(tourId)` | `/get_virtual_tour` | `VirtualTour` |
| `waitForVirtualTour(tourId, { intervalMs?, timeoutMs? })` | polls `/get_virtual_tour` | `VirtualTour` |
| `listVirtualTours({ propertyId? })` | `/list_virtual_tours` | `VirtualToursResponse` |
| `updateVirtualTour({ tourId, ... })` | `/update_virtual_tour` | `VirtualTour` |
| `addVirtualTourScenes({ tourId, scenes, linking? })` | `/add_virtual_tour_scenes` | `VirtualTourJobResponse` |
| `deleteVirtualTour(tourId)` | `/delete_virtual_tour` | `DeleteVirtualTourResponse` |
| `createUploadLink({ propertyId?, name?, type?, language? })` | `/create_upload_link` | `UploadLinkResponse` |
| `credits()` | `/credits` | `CreditsResponse` |
| `feedback({ imageUrl \| imageId, vote, comment?, creditBack? })` | `/feedback` | `FeedbackResponse` |

### Examples

```ts
// Enhance — preserve exact framing (verification verticals)
await pedra.enhance({ imageUrl, preserveOriginalFraming: true });

// Empty a room
const { url } = await pedra.empty({ imageUrl });

// Renovate, furnished
await pedra.renovation({ imageUrl, style: "Scandinavian", furnish: true });

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

## Virtual tours

POST your 360° photos, get back a hosted, linked, shareable virtual tour. AI
names the rooms and places the door-to-door navigation points. Photos must be
2:1 equirectangular (JPEG/PNG/WebP, up to 80 MB each; max 50 rooms per tour).

Unlike the other methods, building a tour is **asynchronous**:
`createVirtualTour` returns a `tourId` straight away with `status: "processing"`
(about 10 s per linked room), and `waitForVirtualTour` polls until it's
`"ready"` or `"failed"`.

```ts
const { tourId } = await pedra.createVirtualTour({
  name: "Calle Mayor 12",
  // In walking order. Omit `name` and AI names the room.
  scenes: [
    { imageUrl: "https://example.com/360/entrance.jpg", name: "Entrance" },
    { imageUrl: "https://example.com/360/living-room.jpg" },
    { imageUrl: "https://example.com/360/kitchen.jpg" },
  ],
});

const tour = await pedra.waitForVirtualTour(tourId);
if (tour.status === "ready") {
  console.log(tour.tourUrl);   // share this
  console.log(tour.embedCode); // or embed this <iframe>
} else {
  console.error(tour.error, tour.failedScenes); // failed builds cost nothing
}
```

**Linking** (`linking`): `"sequential"` (default) links each room to the next,
both ways — pass rooms in walking order; costs `max(3, ceil(rooms / 3))`
credits. `"smart"` lets AI work out which rooms visibly connect (slower, up to
40 rooms, 5–160 credits by room count). `"none"` is free — place links yourself
with `updateVirtualTour({ links })`. Credits are only charged when linking
starts. `language` (`en` `es` `fr` `de` `it` `pt`) sets the tour page's language
and the AI room names. One tour per property; a second `createVirtualTour` on
the same property rejects with HTTP 409 (`err.body.code === "tour_exists"`,
`err.body.tourId`).

**360° photos on disk** — `addLocalPanoramas` base64-encodes local files and
adds them to a property in order (batched under the API's 10-per-call and
50 MB limits); then build the tour from every 360° photo in the property:

```ts
const { propertyId } = await pedra.createProperty({ name: "Calle Mayor 12" });
const { added, failed } = await pedra.addLocalPanoramas(propertyId, [
  "./360/01-entrance.jpg",
  "./360/02-living.jpg",
  "./360/03-kitchen.jpg",
]);
const { tourId } = await pedra.createVirtualTour({ propertyId });
```

Files over ~33 MB are too big to send inline; `createUploadLink` gives you a
no-login page (phone or computer, valid 24 h, up to 100 files) where anyone can
drop photos into a property — then call `createVirtualTour({ propertyId })`:

```ts
const { uploadUrl, propertyId } = await pedra.createUploadLink({ name: "Calle Mayor 12", type: "360" });
```

`type: "360"` takes only 360° photos. The default, `"any"`, takes regular
photos too (2:1 images are stored as 360° photos automatically; iPhone HEIC
works from Safari), so the same link works for photos to edit or turn into a
video: list them afterwards with `listPropertyImages({ propertyId })`.

**Editing** is free and instant:

```ts
await pedra.updateVirtualTour({
  tourId,
  sceneNames: { [sceneId]: "Kitchen" },
  sceneOrder: [entranceId, livingId, kitchenId], // first one opens the tour
  navigationStyle: "blue",                      // "white" | "blue"
  navigationSize: "large",                      // "small" | "medium" | "large"
  showLabels: true,
});

// Append rooms (links only the new stretch), then wait again.
await pedra.addVirtualTourScenes({ tourId, scenes: [{ imageUrl: "https://example.com/360/terrace.jpg" }] });
await pedra.waitForVirtualTour(tourId);

// List the 360° photos in a property (their imageIds are scene ids).
const { images } = await pedra.listPropertyImages({ propertyId, type: "360" });
```

On the free plan the tour builds, but its public link shows an upgrade page:
responses carry `shareable: false` and a `shareableNote`.

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

`err.code` carries the API's machine-readable code when there is one. Limits
worth handling:

| Status | `code` | When |
|---|---|---|
| 429 | `upload_limit` | Daily upload limit reached (30 images/day free, 500 paid, reset at midnight UTC). Counts every image stored from outside the app: `addImagesToProperty`, URL scenes in `createVirtualTour` / `addVirtualTourScenes`, and upload-link files. The whole call is refused; nothing is stored. |
| 429 | `upload_link_limit` | Too many upload links today (5 free, 50 paid). Reuse one of today's links. |
| 429 | `rate_limited` | Too many `requestAccess` calls. |
| 409 | `tour_exists` | The property already has a virtual tour. |

`PedraApiError` is also thrown when a long request fails *after* the heartbeat
has started — the API returns HTTP 200 with an `{ error }` body in that case, and
the SDK surfaces it as an error anyway.

## Links

- API documentation: https://pedra.ai/api-documentation
- Pedra: https://pedra.ai

## License

MIT
