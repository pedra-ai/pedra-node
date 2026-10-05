const { test } = require("node:test");
const assert = require("node:assert");
const { Pedra, PedraError, PedraApiError } = require("../dist/index.js");

// A fake fetch that records the last request and returns a canned response.
function fakeFetch(response) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    return {
      ok: response.ok !== false,
      status: response.status ?? 200,
      text: async () => response.text,
    };
  };
  fn.calls = calls;
  return fn;
}

test("requires an API key", () => {
  const prev = process.env.PEDRA_API_KEY;
  delete process.env.PEDRA_API_KEY;
  assert.throws(() => new Pedra(), PedraError);
  if (prev) process.env.PEDRA_API_KEY = prev;
});

test("sends apiKey and params in the body", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ message: "ok", output: [{ url: "https://x/1" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.furnish({ imageUrl: "https://img", roomType: "Living room" });

  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/furnish");
  assert.deepEqual(fetch.calls[0].body, { apiKey: "k", imageUrl: "https://img", roomType: "Living room" });
  assert.equal(res.url, "https://x/1");
  assert.deepEqual(res.urls, ["https://x/1"]);
});

test("normalizes a single-object output into urls/url", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ output: { url: "https://x/2" } }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.editViaPrompt({ imageUrl: "https://img", prompt: "make it cozy" });
  assert.equal(res.url, "https://x/2");
  assert.deepEqual(res.urls, ["https://x/2"]);
});

test("tolerates the heartbeat whitespace prefix", async () => {
  const fetch = fakeFetch({ text: "    " + JSON.stringify({ output: [{ url: "https://x/3" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.enhance({ imageUrl: "https://img" });
  assert.equal(res.url, "https://x/3");
});

test("edits forward propertyId and name and return source", async () => {
  const fetch = fakeFetch({
    text: JSON.stringify({
      output: [{ url: "https://x/4" }],
      source: { imageId: "img1", name: "IMG_0412.jpg" },
    }),
  });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.furnish({ imageUrl: "https://img", propertyId: "p1", name: "IMG_0412.jpg" });
  assert.deepEqual(fetch.calls[0].body, {
    apiKey: "k",
    imageUrl: "https://img",
    propertyId: "p1",
    name: "IMG_0412.jpg",
  });
  assert.deepEqual(res.source, { imageId: "img1", name: "IMG_0412.jpg" });
});

test("leaves source unset when the API sends none", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ output: [{ url: "https://x/5" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.enhance({ imageUrl: "https://img" });
  assert.equal(res.source, undefined);
});

test("sends deprecated preserveOriginalFraming as highFidelity", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ output: [{ url: "https://x/6" }] }) });
  const pedra = new Pedra("k", { fetch });
  await pedra.enhance({ imageUrl: "https://img", preserveOriginalFraming: true });
  assert.deepEqual(fetch.calls[0].body, { apiKey: "k", imageUrl: "https://img", highFidelity: true });
});

test("addImagesToProperty forwards names", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", added: [], failed: [] }) });
  const pedra = new Pedra("k", { fetch });
  await pedra.addImagesToProperty({ propertyId: "p1", imageUrls: ["https://a"], names: ["front.jpg"] });
  assert.deepEqual(fetch.calls[0].body.names, ["front.jpg"]);
});

test("throws on a 4xx error body", async () => {
  const fetch = fakeFetch({ ok: false, status: 403, text: JSON.stringify({ error: "Insufficient credits" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.enhance({ imageUrl: "https://img" }), (err) => {
    assert.ok(err instanceof PedraApiError);
    assert.equal(err.status, 403);
    assert.match(err.message, /Insufficient credits/);
    return true;
  });
});

test("throws when a long request fails with HTTP 200 + error body", async () => {
  const fetch = fakeFetch({ ok: true, status: 200, text: JSON.stringify({ error: "Video processing failed" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.createVideo({ images: [{ imageUrl: "https://img" }] }), PedraApiError);
});

test("updateVideo posts videoId and returns the new URL", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ message: "updated", videoId: "v1", videoUrl: "https://v/2" }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.updateVideo({ videoId: "v1", music: { track: "cinematic" } });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/update_video");
  assert.equal(fetch.calls[0].body.videoId, "v1");
  assert.equal(fetch.calls[0].body.music.track, "cinematic");
  assert.equal(res.videoId, "v1");
  assert.equal(res.videoUrl, "https://v/2");
});

test("generateVoice returns an audioId", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ audioId: "a1", audioUrl: "https://aud/1", duration: 7 }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.generateVoice({ text: "A bright home.", language: "Español" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/generate_voice");
  assert.equal(fetch.calls[0].body.text, "A bright home.");
  assert.equal(res.audioId, "a1");
  assert.equal(res.duration, 7);
});

test("generateVoice forwards the chosen voiceId", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ audioId: "a1", audioUrl: "https://aud/1" }) });
  const pedra = new Pedra("k", { fetch });
  await pedra.generateVoice({ text: "A bright home.", language: "Español", voiceId: "JBFqnCBsd6RMkjVDRZzb" });
  assert.equal(fetch.calls[0].body.voiceId, "JBFqnCBsd6RMkjVDRZzb");
});

test("generateVoiceScript returns script text", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ script: "Lovely place." }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.generateVoiceScript({ images: ["https://a"] });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/generate_voice_script");
  assert.equal(res.script, "Lovely place.");
});

test("musicLibrary returns tracks and voice languages", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ tracks: [{ track: "chill", label: "Chill Beats" }], variantsPerTrack: 6, defaultTrack: "chill", voiceLanguages: ["English"] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.musicLibrary();
  assert.equal(res.defaultTrack, "chill");
  assert.equal(res.variantsPerTrack, 6);
  assert.equal(res.tracks[0].track, "chill");
  assert.deepEqual(res.voiceLanguages, ["English"]);
  assert.deepEqual(res.voicesByLanguage, []);
});

test("musicLibrary exposes the voices offered per language", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ tracks: [], voiceLanguages: ["English"], voicesByLanguage: [{ language: "English", voices: [{ voiceId: "v1", name: "Rachel", gender: "female", accent: "american", descriptor: "calm" }] }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.musicLibrary();
  assert.equal(res.voicesByLanguage[0].language, "English");
  assert.equal(res.voicesByLanguage[0].voices[0].name, "Rachel");
});

test("listProperties returns properties", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ properties: [{ propertyId: "p1", name: "Listing", photoCount: 3, appUrl: "https://app.pedra.ai/?propertyId=p1" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.listProperties();
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/list_properties");
  assert.equal(res.properties[0].propertyId, "p1");
  assert.equal(res.properties[0].photoCount, 3);
});

test("listPropertyImages returns image URLs", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", images: [{ imageId: "i1", url: "https://img.pedra.ai/i1" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.listPropertyImages({ propertyId: "p1" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/list_property_images");
  assert.equal(fetch.calls[0].body.propertyId, "p1");
  assert.equal(res.images[0].url, "https://img.pedra.ai/i1");
});

test("createProperty returns id and appUrl", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ message: "Property created", propertyId: "p2", appUrl: "https://app.pedra.ai/?propertyId=p2" }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.createProperty({ name: "New listing" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/create_property");
  assert.equal(res.propertyId, "p2");
  assert.match(res.appUrl, /propertyId=p2/);
});

test("addImagesToProperty posts urls and returns added", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ message: "Added 1 image(s)", propertyId: "p1", added: [{ imageId: "i9", url: "https://img.pedra.ai/i9" }], failed: [] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.addImagesToProperty({ propertyId: "p1", imageUrls: ["https://x/a.jpg"] });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/add_images_to_property");
  assert.deepEqual(fetch.calls[0].body.imageUrls, ["https://x/a.jpg"]);
  assert.equal(res.added[0].url, "https://img.pedra.ai/i9");
});

test("credits() returns plan and creditsRemaining", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ plan: "pro", creditsRemaining: 42 }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.credits();
  assert.equal(res.plan, "pro");
  assert.equal(res.creditsRemaining, 42);
});

// --- virtual tours -----------------------------------------------------------

// A fake fetch that returns a different canned response per call.
function sequenceFetch(responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    return { ok: r.ok !== false, status: r.status ?? 200, text: async () => r.text };
  };
  fn.calls = calls;
  return fn;
}

const TOUR = {
  tourId: "t1",
  propertyId: "p1",
  name: "Calle Mayor 12",
  status: "ready",
  tourUrl: "https://app.pedra.ai/virtual-tour/t1",
  embedCode: "<iframe src=\"https://app.pedra.ai/virtual-tour/t1\"></iframe>",
  appUrl: "https://app.pedra.ai/?projectId=p1",
  shareable: true,
  sceneCount: 2,
  linkCount: 2,
  coverImageUrl: "https://img.pedra.ai/s1",
  scenes: [{ sceneId: "s1", name: "Entrance", imageUrl: "https://img.pedra.ai/s1" }],
  links: [{ linkId: "ai-1", fromSceneId: "s1", toSceneId: "s2", yaw: -18, pitch: 0, aiGenerated: true }],
  settings: { navigationStyle: "white", navigationSize: "medium", showLabels: false, language: "en" },
};

test("listPropertyImages forwards type 360", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", images: [] }) });
  const pedra = new Pedra("k", { fetch });
  await pedra.listPropertyImages({ propertyId: "p1", type: "360" });
  assert.equal(fetch.calls[0].body.type, "360");
});

test("listPropertyImages omits type when unset", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", images: [] }) });
  const pedra = new Pedra("k", { fetch });
  await pedra.listPropertyImages({ propertyId: "p1" });
  assert.ok(!("type" in fetch.calls[0].body));
});

test("addImagesToProperty forwards type 360 and returns it", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", type: "360", added: [{ imageId: "s1", url: "https://img.pedra.ai/s1", aspectRatio: 2 }], failed: [] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.addImagesToProperty({ propertyId: "p1", imageUrls: ["https://x/pano.jpg"], type: "360" });
  assert.equal(fetch.calls[0].body.type, "360");
  assert.equal(res.type, "360");
  assert.equal(res.added[0].aspectRatio, 2);
});

test("createVirtualTour posts scenes and returns the tour job", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ ...TOUR, status: "processing", progress: { stage: "queued" }, creditsCost: 3, estimatedSeconds: 47, linking: "sequential", message: "Building the tour." }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.createVirtualTour({
    name: "Calle Mayor 12",
    scenes: [{ imageUrl: "https://x/entrance.jpg", name: "Entrance" }, "https://x/kitchen.jpg"],
    linking: "smart",
    language: "es",
  });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/create_virtual_tour");
  assert.deepEqual(fetch.calls[0].body.scenes, [{ imageUrl: "https://x/entrance.jpg", name: "Entrance" }, "https://x/kitchen.jpg"]);
  assert.equal(fetch.calls[0].body.linking, "smart");
  assert.equal(fetch.calls[0].body.language, "es");
  assert.equal(res.tourId, "t1");
  assert.equal(res.status, "processing");
  assert.equal(res.progress.stage, "queued");
  assert.equal(res.creditsCost, 3);
  assert.ok(res.raw);
});

test("getVirtualTour returns scenes, links and settings", async () => {
  const fetch = fakeFetch({ text: JSON.stringify(TOUR) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.getVirtualTour("t1");
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/get_virtual_tour");
  assert.deepEqual(fetch.calls[0].body, { apiKey: "k", tourId: "t1" });
  assert.equal(res.tourUrl, "https://app.pedra.ai/virtual-tour/t1");
  assert.equal(res.links[0].yaw, -18);
  assert.equal(res.settings.navigationStyle, "white");
});

test("getVirtualTour resolves a failed build instead of throwing on its error field", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ ...TOUR, status: "failed", error: "1 of 2 scenes could not be added", failedScenes: [{ index: 1, imageUrl: "https://x/b.jpg", error: "not 360" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.getVirtualTour("t1");
  assert.equal(res.status, "failed");
  assert.match(res.error, /could not be added/);
  assert.equal(res.failedScenes[0].index, 1);
});

test("getVirtualTour still throws on a real API error", async () => {
  const fetch = fakeFetch({ ok: false, status: 404, text: JSON.stringify({ error: "Virtual tour not found" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.getVirtualTour("nope"), (err) => {
    assert.ok(err instanceof PedraApiError);
    assert.equal(err.status, 404);
    return true;
  });
});

test("createVirtualTour surfaces 409 tour_exists with its body", async () => {
  const fetch = fakeFetch({ ok: false, status: 409, text: JSON.stringify({ error: "This property already has a virtual tour", code: "tour_exists", tourId: "t1" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.createVirtualTour({ propertyId: "p1" }), (err) => {
    assert.equal(err.status, 409);
    assert.equal(err.body.code, "tour_exists");
    assert.equal(err.body.tourId, "t1");
    return true;
  });
});

test("listVirtualTours returns tours", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ tours: [{ tourId: "t1", status: "ready" }] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.listVirtualTours({ propertyId: "p1" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/list_virtual_tours");
  assert.equal(fetch.calls[0].body.propertyId, "p1");
  assert.equal(res.tours[0].tourId, "t1");
});

test("listVirtualTours works with no params", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ tours: [] }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.listVirtualTours();
  assert.deepEqual(fetch.calls[0].body, { apiKey: "k" });
  assert.deepEqual(res.tours, []);
});

test("updateVirtualTour sends sceneNames keyed by sceneId, untouched", async () => {
  const fetch = fakeFetch({ text: JSON.stringify(TOUR) });
  const pedra = new Pedra("k", { fetch });
  await pedra.updateVirtualTour({
    tourId: "t1",
    sceneNames: { "f1815046-aaaa": "Kitchen" },
    links: [{ fromSceneId: "s1", toSceneId: "s2", yaw: 90 }],
    showLabels: true,
  });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/update_virtual_tour");
  assert.deepEqual(fetch.calls[0].body.sceneNames, { "f1815046-aaaa": "Kitchen" });
  assert.equal(fetch.calls[0].body.links[0].yaw, 90);
  assert.equal(fetch.calls[0].body.showLabels, true);
});

test("addVirtualTourScenes posts tourId + scenes", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ ...TOUR, status: "processing", addedScenes: [{ sceneId: "s3", name: null, source: "property" }], creditsCost: 3 }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.addVirtualTourScenes({ tourId: "t1", scenes: [{ imageId: "s3" }], linking: "none" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/add_virtual_tour_scenes");
  assert.equal(fetch.calls[0].body.linking, "none");
  assert.equal(res.addedScenes[0].sceneId, "s3");
});

test("deleteVirtualTour posts tourId", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ message: "Virtual tour deleted.", tourId: "t1" }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.deleteVirtualTour("t1");
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/delete_virtual_tour");
  assert.equal(res.tourId, "t1");
});

test("createUploadLink returns the upload page", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ uploadUrl: "https://app.pedra.ai/upload/tok", propertyId: "p9", propertyName: "Calle Mayor 12", expiresAt: "2026-10-01T15:26:30.687Z", appUrl: "https://app.pedra.ai/?projectId=p9" }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.createUploadLink({ name: "Calle Mayor 12", language: "es" });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/create_upload_link");
  assert.equal(fetch.calls[0].body.language, "es");
  assert.equal(res.uploadUrl, "https://app.pedra.ai/upload/tok");
  assert.equal(res.propertyId, "p9");
});

test("waitForVirtualTour polls until ready", async () => {
  const fetch = sequenceFetch([
    { text: JSON.stringify({ ...TOUR, status: "processing", progress: { stage: "importing", done: 1, total: 2 } }) },
    { text: JSON.stringify({ ...TOUR, status: "processing", progress: { stage: "linking" } }) },
    { text: JSON.stringify(TOUR) },
  ]);
  const pedra = new Pedra("k", { fetch });
  const tour = await pedra.waitForVirtualTour("t1", { intervalMs: 1 });
  assert.equal(fetch.calls.length, 3);
  assert.equal(tour.status, "ready");
  assert.equal(tour.tourUrl, TOUR.tourUrl);
});

test("waitForVirtualTour returns a failed tour", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ ...TOUR, status: "failed", error: "The build failed." }) });
  const pedra = new Pedra("k", { fetch });
  const tour = await pedra.waitForVirtualTour("t1", { intervalMs: 1 });
  assert.equal(tour.status, "failed");
});

test("waitForVirtualTour throws after the timeout", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ ...TOUR, status: "processing" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.waitForVirtualTour("t1", { intervalMs: 5, timeoutMs: 20 }), PedraError);
});

// --- addLocalPanoramas -------------------------------------------------------

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function tmpFiles(specs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pedra-sdk-"));
  const files = specs.map(([name, size]) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, Buffer.alloc(size, 7));
    return file;
  });
  return { dir, files };
}

function panoFetch() {
  let n = 0;
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    const added = body.imageUrls.map(() => ({ imageId: `s${++n}`, url: `https://img.pedra.ai/s${n}`, aspectRatio: 2 }));
    return { ok: true, status: 200, text: async () => JSON.stringify({ propertyId: body.propertyId, type: "360", added, failed: [], appUrl: "https://app.pedra.ai/?projectId=p1" }) };
  };
  fn.calls = calls;
  return fn;
}

test("addLocalPanoramas sends data URIs with type 360, in order, 10 per call", async () => {
  const { dir, files } = tmpFiles(Array.from({ length: 12 }, (_, i) => [`pano${String(i).padStart(2, "0")}.jpg`, 30]));
  try {
    const fetch = panoFetch();
    const pedra = new Pedra("k", { fetch });
    const res = await pedra.addLocalPanoramas("p1", files);
    assert.equal(fetch.calls.length, 2);
    assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/add_images_to_property");
    assert.equal(fetch.calls[0].body.type, "360");
    assert.equal(fetch.calls[0].body.imageUrls.length, 10);
    assert.equal(fetch.calls[1].body.imageUrls.length, 2);
    assert.match(fetch.calls[0].body.imageUrls[0], /^data:image\/jpeg;base64,/);
    assert.equal(res.added.length, 12);
    assert.equal(res.added[0].path, files[0]);
    assert.equal(res.added[11].path, files[11]);
    assert.equal(res.type, "360");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("addLocalPanoramas splits batches by request size and rejects oversize files locally", async () => {
  const { dir, files } = tmpFiles([["a.jpg", 600], ["b.png", 600], ["c.webp", 3000], ["d.txt", 10]]);
  try {
    const fetch = panoFetch();
    const pedra = new Pedra("k", { fetch });
    // ~1 KB budget: a and b each fit alone but not together; c never fits.
    const res = await pedra.addLocalPanoramas("p1", [...files, path.join(dir, "missing.jpg")], { maxRequestBytes: 1024 });
    assert.equal(fetch.calls.length, 2);
    assert.match(fetch.calls[1].body.imageUrls[0], /^data:image\/png;base64,/);
    assert.deepEqual(res.added.map((a) => a.path), [files[0], files[1]]);
    const errors = Object.fromEntries(res.failed.map((f) => [path.basename(f.path), f.error]));
    assert.match(errors["c.webp"], /too large to send inline/);
    assert.match(errors["d.txt"], /Unsupported file type/);
    assert.match(errors["missing.jpg"], /Could not read file/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("addLocalPanoramas maps API rejections back to their file", async () => {
  const { dir, files } = tmpFiles([["flat.jpg", 20]]);
  try {
    const fetch = fakeFetch({ text: JSON.stringify({ propertyId: "p1", type: "360", added: [], failed: [{ url: "data: URI", error: "this is not a 360° photo" }] }) });
    const pedra = new Pedra("k", { fetch });
    const res = await pedra.addLocalPanoramas("p1", files);
    assert.equal(res.failed[0].path, files[0]);
    assert.equal(res.failed[0].url, files[0]);
    assert.match(res.failed[0].error, /not a 360/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- upload links: type + limits ---------------------------------------------

test("createUploadLink sends type and returns type + maxFiles", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ uploadUrl: "https://app.pedra.ai/upload/tok", propertyId: "p9", type: "360", maxFiles: 100, expiresAt: "2026-10-01T15:26:30.687Z" }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.createUploadLink({ propertyId: "p9", type: "360" });
  assert.deepEqual(fetch.calls[0].body, { apiKey: "k", propertyId: "p9", type: "360" });
  assert.equal(res.type, "360");
  assert.equal(res.maxFiles, 100);
});

test("createUploadLink 429 upload_link_limit exposes code on the error", async () => {
  const body = { error: "This account can make 5 upload links a day.", code: "upload_link_limit" };
  const fetch = fakeFetch({ ok: false, status: 429, text: JSON.stringify(body) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.createUploadLink({}), (err) => {
    assert.ok(err instanceof PedraApiError);
    assert.equal(err.status, 429);
    assert.equal(err.code, "upload_link_limit");
    assert.deepEqual(err.body, body);
    return true;
  });
});

test("addImagesToProperty 429 upload_limit exposes code on the error", async () => {
  const fetch = fakeFetch({ ok: false, status: 429, text: JSON.stringify({ error: "Daily upload limit reached", code: "upload_limit" }) });
  const pedra = new Pedra("k", { fetch });
  await assert.rejects(() => pedra.addImagesToProperty({ propertyId: "p1", imageUrls: ["https://x/1.jpg"] }), (err) => {
    assert.equal(err.status, 429);
    assert.equal(err.code, "upload_limit");
    return true;
  });
});

test("errors without a code leave code undefined", async () => {
  const fetch = fakeFetch({ ok: false, status: 403, text: JSON.stringify({ error: "Insufficient credits" }) });
  await assert.rejects(() => new Pedra("k", { fetch }).enhance({ imageUrl: "https://img" }), (err) => {
    assert.equal(err.code, undefined);
    return true;
  });
});

// --- agent signup (no API key) -----------------------------------------------

const { requestAccess, getAccessStatus, waitForAccess } = require("../dist/index.js");

const APPROVED = {
  status: "approved",
  apiKey: "new-key",
  email: "ana@agency.com",
  newAccount: true,
  plan: "free",
  creditsRemaining: 0,
  appUrl: "https://app.pedra.ai",
  note: "This account has no credits yet.",
};

test("requestAccess works without an API key and sends no apiKey", async () => {
  const prev = process.env.PEDRA_API_KEY;
  delete process.env.PEDRA_API_KEY;
  try {
    const fetch = fakeFetch({ text: JSON.stringify({ requestId: "r1", status: "pending", expiresAt: "2026-09-30T12:30:00.000Z", pollAfterSeconds: 5, message: "We emailed a link" }) });
    const res = await requestAccess({ email: "ana@agency.com", agentName: "Test agent" }, { fetch });
    assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/agent_signup");
    assert.deepEqual(fetch.calls[0].body, { email: "ana@agency.com", agentName: "Test agent" });
    assert.equal(res.requestId, "r1");
    assert.equal(res.status, "pending");
    assert.equal(res.pollAfterSeconds, 5);
  } finally {
    if (prev) process.env.PEDRA_API_KEY = prev;
  }
});

test("Pedra.requestAccess is the same static function", async () => {
  assert.equal(Pedra.requestAccess, requestAccess);
  assert.equal(Pedra.getAccessStatus, getAccessStatus);
  assert.equal(Pedra.waitForAccess, waitForAccess);
  const fetch = fakeFetch({ text: JSON.stringify({ requestId: "r2", status: "pending" }) });
  const res = await Pedra.requestAccess({ email: "a@b.co" }, { fetch, baseUrl: "http://localhost:3000/api/" });
  assert.equal(fetch.calls[0].url, "http://localhost:3000/api/agent_signup");
  assert.equal(res.requestId, "r2");
});

test("requestAccess requires an email", async () => {
  await assert.rejects(() => requestAccess({ email: "" }, { fetch: fakeFetch({ text: "{}" }) }), PedraError);
});

for (const [status, code] of [[400, "disposable_email"], [429, "rate_limited"], [503, "unavailable"]]) {
  test(`requestAccess ${status} ${code} throws PedraApiError with code and body`, async () => {
    const body = { error: "nope", code };
    const fetch = fakeFetch({ ok: false, status, text: JSON.stringify(body) });
    await assert.rejects(() => requestAccess({ email: "a@b.co" }, { fetch }), (err) => {
      assert.ok(err instanceof PedraApiError);
      assert.equal(err.status, status);
      assert.equal(err.code, code);
      assert.deepEqual(err.body, body);
      return true;
    });
  });
}

test("getAccessStatus returns the approved key", async () => {
  const fetch = fakeFetch({ text: JSON.stringify(APPROVED) });
  const res = await getAccessStatus("r1", { fetch });
  assert.equal(fetch.calls[0].url, "https://app.pedra.ai/api/agent_signup_status");
  assert.deepEqual(fetch.calls[0].body, { requestId: "r1" });
  assert.equal(res.status, "approved");
  assert.equal(res.apiKey, "new-key");
  assert.equal(res.newAccount, true);
  assert.equal(res.creditsRemaining, 0);
  assert.match(res.note, /no credits/);
});

test("getAccessStatus unknown requestId throws 404", async () => {
  const fetch = fakeFetch({ ok: false, status: 404, text: JSON.stringify({ error: "Unknown requestId" }) });
  await assert.rejects(() => getAccessStatus("nope", { fetch }), (err) => err instanceof PedraApiError && err.status === 404);
});

test("waitForAccess polls until approved", async () => {
  const fetch = sequenceFetch([
    { text: JSON.stringify({ status: "pending", pollAfterSeconds: 5 }) },
    { text: JSON.stringify({ status: "pending", pollAfterSeconds: 5 }) },
    { text: JSON.stringify(APPROVED) },
  ]);
  const res = await waitForAccess("r1", { fetch, intervalMs: 1 });
  assert.equal(fetch.calls.length, 3);
  assert.equal(res.status, "approved");
  assert.equal(res.apiKey, "new-key");
});

test("waitForAccess resolves (doesn't throw) on denied and expired", async () => {
  for (const status of ["denied", "expired"]) {
    const fetch = sequenceFetch([{ text: JSON.stringify({ status: "pending" }) }, { text: JSON.stringify({ status }) }]);
    const res = await waitForAccess("r1", { fetch, intervalMs: 1 });
    assert.equal(res.status, status);
    assert.equal(res.apiKey, undefined);
  }
});

test("waitForAccess throws after timeoutMs while still pending", async () => {
  const fetch = sequenceFetch([{ text: JSON.stringify({ status: "pending" }) }]);
  await assert.rejects(() => waitForAccess("r1", { fetch, intervalMs: 50, timeoutMs: 10 }), (err) => {
    assert.ok(err instanceof PedraError);
    assert.match(err.message, /still pending/);
    return true;
  });
});
