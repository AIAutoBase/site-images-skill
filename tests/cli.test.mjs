import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tempDir } from "./helpers.mjs";

const CLI = path.resolve("skill/scripts/site-images.mjs");
const sharp = createRequire(new URL("../skill/package.json", import.meta.url))("sharp");

function setup(providers = { cloudflare: true }) {
  const home = tempDir("home");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ providers }));
  fs.writeFileSync(path.join(home, ".env"), "CF_ACCOUNT_ID=a\nCF_API_TOKEN=t\n");
  const root = tempDir("proj");
  fs.mkdirSync(path.join(root, "public"));
  const brief = path.join(root, "brief.json");
  fs.writeFileSync(brief, JSON.stringify({
    projectRoot: root, slot: "hero", filename: "Hero Coffee Shop", purpose: "home hero",
    subject: "a barista", place: "a cafe", style: "warm photo",
  }));
  return { home, root, brief };
}

function run(ctx, args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, SITE_IMAGES_HOME: ctx.home, SITE_IMAGES_PROVIDER_OVERRIDE: "fake", SITE_IMAGES_FAKE_FAIL: "", ...env },
  });
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null, err: r.stderr };
}

test("generate attempt 1 writes candidate and reports provider", () => {
  const ctx = setup();
  const r = run(ctx, ["generate", "--brief", ctx.brief, "--attempt", "1"]);
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.provider, "cloudflare");
  assert.equal(r.out.attempt, 1);
  assert.match(r.out.prompt, /a barista/);
  assert.match(r.out.candidate, /^\.site-images\/candidates\/hero-coffee-shop\.attempt-1\.png$/);
  assert.ok(fs.existsSync(path.join(ctx.root, r.out.candidate)));
});

test("generate attempt 3 exits 3", () => {
  const ctx = setup();
  const r = run(ctx, ["generate", "--brief", ctx.brief, "--attempt", "3"]);
  assert.equal(r.code, 3);
  assert.match(r.out.error, /max attempts/);
});

test("generate with chatgpt failing falls back to cloudflare, attempt stays 1", () => {
  const ctx = setup({ cloudflare: true, chatgpt: true });
  const r = run(ctx, ["generate", "--brief", ctx.brief, "--attempt", "1", "--provider", "chatgpt"], { SITE_IMAGES_FAKE_FAIL: "chatgpt:session" });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.out.provider, "cloudflare");
  assert.equal(r.out.fellBackFrom, "chatgpt");
  assert.match(r.out.fallbackReason, /session/);
  assert.equal(r.out.attempt, 1);
});

test("cloudflare quota with gemini enabled falls back to gemini; with none enabled exits 5", () => {
  const withGemini = setup({ cloudflare: true, gemini: true });
  const a = run(withGemini, ["generate", "--brief", withGemini.brief, "--attempt", "1"], { SITE_IMAGES_FAKE_FAIL: "cloudflare:quota" });
  assert.equal(a.code, 0, a.err);
  assert.equal(a.out.provider, "gemini");
  assert.equal(a.out.fellBackFrom, "cloudflare");
  const alone = setup({ cloudflare: true });
  const b = run(alone, ["generate", "--brief", alone.brief, "--attempt", "1"], { SITE_IMAGES_FAKE_FAIL: "cloudflare:quota" });
  assert.equal(b.code, 5);
  assert.match(b.out.error, /used up/);
});

test("finalize places hero, logs it, adds .site-images/ to .gitignore", async () => {
  const ctx = setup();
  fs.writeFileSync(path.join(ctx.root, ".gitignore"), "node_modules/\n");
  const cand = path.join(ctx.root, "cand.png");
  fs.writeFileSync(cand, await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#abc" } }).png().toBuffer());
  const r = run(ctx, ["finalize", "--brief", ctx.brief, "--candidate", cand, "--provider", "cloudflare"]);
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.out, { path: "public/images/hero-coffee-shop.webp", width: 1920, height: 1080 });
  const log = JSON.parse(fs.readFileSync(path.join(ctx.root, "site-images.json"), "utf8")).log;
  assert.equal(log[0].path, "public/images/hero-coffee-shop.webp");
  assert.equal(log[0].provider, "cloudflare");
  assert.match(fs.readFileSync(path.join(ctx.root, ".gitignore"), "utf8"), /^\.site-images\/$/m);
  assert.match(fs.readFileSync(path.join(ctx.root, ".gitignore"), "utf8"), /^node_modules\/$/m);
});

test("finalize twice replaces its own file instead of making -2", async () => {
  const ctx = setup();
  const cand = path.join(ctx.root, "cand.png");
  fs.writeFileSync(cand, await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#abc" } }).png().toBuffer());
  run(ctx, ["finalize", "--brief", ctx.brief, "--candidate", cand]);
  const r = run(ctx, ["finalize", "--brief", ctx.brief, "--candidate", cand]);
  assert.equal(r.out.path, "public/images/hero-coffee-shop.webp");
  assert.equal(JSON.parse(fs.readFileSync(path.join(ctx.root, "site-images.json"), "utf8")).log.length, 1);
});

test("status with empty home reports nothing configured", () => {
  const r = run({ home: tempDir("empty") }, ["status"]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.out.configured, { cloudflare: false, chatgpt: false, gemini: false });
});

test("unknown command exits 2", () => {
  assert.equal(run({ home: tempDir("x") }, ["dance"]).code, 2);
});

test("bad brief exits 2 naming the field", () => {
  const ctx = setup();
  fs.writeFileSync(ctx.brief, JSON.stringify({ projectRoot: ctx.root, slot: "hero" }));
  const r = run(ctx, ["generate", "--brief", ctx.brief, "--attempt", "1"]);
  assert.equal(r.code, 2);
  assert.match(r.out.error, /filename/);
});
