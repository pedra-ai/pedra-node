// Live smoke test against the real Pedra API.
// Usage: PEDRA_API_KEY=... node examples/smoke.mjs [imageUrl]
//   - Always runs credits() (free).
//   - If an imageUrl is passed, also runs enhance() (consumes 1 credit).
import { Pedra } from "../dist/index.js";

const client = new Pedra(); // reads PEDRA_API_KEY from env

const credits = await client.credits();
console.log("credits():", JSON.stringify({ plan: credits.plan, creditsRemaining: credits.creditsRemaining }));

const imageUrl = process.argv[2];
if (imageUrl) {
  console.log("enhance() on:", imageUrl);
  const out = await client.enhance({ imageUrl });
  console.log("enhance() ->", JSON.stringify({ url: out.url, urls: out.urls, keys: Object.keys(out) }));
}
