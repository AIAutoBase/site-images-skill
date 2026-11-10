import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseProvider } from "../skill/scripts/lib/select.mjs";

const cfg = (p, cfModel = "@cf/black-forest-labs/flux-2-klein-4b") => ({ providers: { cloudflare: false, chatgpt: false, gemini: false, ...p }, cfModel });
const hero = { slot: "hero" };

test("select: inImageText + chatgpt enabled → chatgpt", () => {
  assert.equal(chooseProvider({ ...hero, inImageText: "Open" }, cfg({ cloudflare: true, chatgpt: true })), "chatgpt");
});

test("select: pinned wins over everything", () => {
  assert.equal(chooseProvider({ ...hero, inImageText: "Open" }, cfg({ cloudflare: true, chatgpt: true }), { pinned: "gemini", requested: "chatgpt" }), "gemini");
});

test("select: requested provider used when enabled, ignored when not", () => {
  assert.equal(chooseProvider(hero, cfg({ cloudflare: true, gemini: true }), { requested: "gemini" }), "gemini");
  assert.equal(chooseProvider(hero, cfg({ cloudflare: true }), { requested: "gemini" }), "cloudflare");
});

test("select: nothing enabled but cloudflare → cloudflare", () => {
  assert.equal(chooseProvider({ ...hero, inImageText: "Open" }, cfg({ cloudflare: true })), "cloudflare");
});

test("select: wide slot goes to browser only when the Cloudflare model is fixed-1024", () => {
  assert.equal(chooseProvider(hero, cfg({ cloudflare: true, gemini: true })), "cloudflare");
  assert.equal(chooseProvider(hero, cfg({ cloudflare: true, gemini: true }, "@cf/black-forest-labs/flux-1-schnell")), "gemini");
});

test("select: only a browser provider set up → that provider", () => {
  assert.equal(chooseProvider(hero, cfg({ gemini: true })), "gemini");
});
