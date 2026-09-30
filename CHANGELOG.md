# Changelog

## 0.4.0

- **Virtual tours.** New methods for the Virtual Tour API: `createVirtualTour`,
  `getVirtualTour`, `listVirtualTours`, `updateVirtualTour`,
  `addVirtualTourScenes`, `deleteVirtualTour`, and `createUploadLink`, with
  typed params/responses (`VirtualTour`, `VirtualTourJobResponse`,
  `TourScene`, `TourLink`, …).
- `waitForVirtualTour(tourId, { intervalMs, timeoutMs })` polls until the tour
  is `ready` or `failed` (a failed build resolves with `status: "failed"` and
  `error`; it doesn't throw).
- `addLocalPanoramas(propertyId, paths)` (Node): uploads 360° photo files from
  disk as base64 `data:` URIs, in order, batched under the API's 10-per-call and
  50 MB body limits. Unsendable files are reported in `failed`.
- `listPropertyImages` and `addImagesToProperty` accept `type: "photo" | "360"`.
- `generateVoice` accepts `voiceId`; `musicLibrary` returns `voicesByLanguage`.
- **Agent signup, no API key needed.** `requestAccess({ email, agentName })`,
  `getAccessStatus(requestId)` and `waitForAccess(requestId, { intervalMs,
  timeoutMs })` (also as `Pedra.requestAccess` etc.): Pedra emails the person a
  confirmation link, and the approved status carries the new `apiKey`.
  `waitForAccess` resolves with `denied` / `expired` rather than throwing.
- `createUploadLink` accepts `type: "any" | "360"` (default `"any"`: regular
  photos and 360° photos) and returns `type` and `maxFiles`.
- `PedraApiError.code` exposes the response's `code` (e.g. `upload_limit`,
  `upload_link_limit`, `rate_limited`, `tour_exists`).

## 0.1.0

- Initial release.
- Full coverage of the Pedra API: `enhance`, `enhanceAndCorrectPerspective`,
  `empty`, `furnish`, `renovation`, `editViaPrompt`, `sky`, `remove`, `blur`,
  `createVideo`, `credits`, `feedback`.
- TypeScript typings, normalized image responses, and typed errors
  (`PedraError`, `PedraApiError`).
