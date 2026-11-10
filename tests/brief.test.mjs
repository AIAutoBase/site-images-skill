import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBrief, buildPrompt } from "../skill/scripts/lib/brief.mjs";
import { SLOTS } from "../skill/scripts/lib/slots.mjs";

const base = {
  projectRoot: "/tmp/p", slot: "hero", filename: "hero-coffee-shop", purpose: "home page hero",
  subject: "a barista pouring latte art", place: "a small sunny cafe counter",
  style: "warm natural-light photography, earthy tones",
};

test("buildPrompt keeps art-director order", () => {
  const p = buildPrompt(validateBrief({ ...base, light: "soft morning light", framing: "medium shot, 35mm" }));
  const at = (s) => { const i = p.indexOf(s); assert.ok(i >= 0, `missing "${s}" in: ${p}`); return i; };
  const order = [at("barista"), at("cafe counter"), at("warm natural-light"), at("soft morning light"), at("35mm"), at("16:9 aspect ratio"), at("Avoid:")];
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test("buildPrompt says no text by default and avoids the standard defects", () => {
  const p = buildPrompt(validateBrief(base));
  assert.match(p, /no text/);
  assert.match(p, /Avoid: garbled text, deformed hands, watermarks, logos/);
});

test("buildPrompt asks for headline space on hero slots only", () => {
  assert.match(buildPrompt(validateBrief(base)), /empty area for headline text/);
  assert.doesNotMatch(buildPrompt(validateBrief({ ...base, slot: "card" })), /headline/);
});

test("buildPrompt quotes in-image text", () => {
  const p = buildPrompt(validateBrief({ ...base, inImageText: "Open Daily" }));
  assert.match(p, /with the text "Open Daily"/);
  assert.doesNotMatch(p, /no text/);
});

test("buildPrompt appends extra avoid items", () => {
  assert.match(buildPrompt(validateBrief({ ...base, avoid: ["people"] })), /logos, people/);
});

test("validateBrief rejects 6-word text", () => {
  assert.throws(() => validateBrief({ ...base, inImageText: "one two three four five six" }), /max 5 words/);
});

test("validateBrief names the missing field", () => {
  const { subject, ...rest } = base;
  assert.throws(() => validateBrief(rest), /subject/);
});

test("validateBrief rejects unknown slot", () => {
  assert.throws(() => validateBrief({ ...base, slot: "banner-xl" }), /slot/);
});

test("validateBrief kebab-cases filename", () => {
  assert.equal(validateBrief({ ...base, filename: "Hero Coffee Shop.PNG" }).filename, "hero-coffee-shop.webp");
});

test("validateBrief uses png when project format is png", () => {
  assert.equal(validateBrief(base, "png").filename, "hero-coffee-shop.png");
});

test("slot presets match the plan", () => {
  assert.deepEqual(SLOTS.hero, { aspect: "16:9", width: 1920 });
  assert.deepEqual(SLOTS.card, { aspect: "4:3", width: 800 });
  assert.deepEqual(SLOTS.avatar, { aspect: "1:1", width: 512 });
  assert.deepEqual(SLOTS["mobile-banner"], { aspect: "9:16", width: 1080 });
  assert.deepEqual(SLOTS.og, { aspect: "1.91:1", width: 1200 });
});

test("validateBrief turns an avoid string into a list (helpers sometimes write a string)", () => {
  const b = validateBrief({ ...base, avoid: "busy background, text on signs" });
  assert.deepEqual(b.avoid, ["busy background", "text on signs"]);
  assert.match(buildPrompt(b), /logos, busy background, text on signs\./);
});

test("validateBrief rejects a non-list, non-text avoid", () => {
  assert.throws(() => validateBrief({ ...base, avoid: 5 }), /avoid/);
});
