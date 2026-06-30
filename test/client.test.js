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
