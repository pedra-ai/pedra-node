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

test("credits() returns plan and creditsRemaining", async () => {
  const fetch = fakeFetch({ text: JSON.stringify({ plan: "pro", creditsRemaining: 42 }) });
  const pedra = new Pedra("k", { fetch });
  const res = await pedra.credits();
  assert.equal(res.plan, "pro");
  assert.equal(res.creditsRemaining, 42);
});
