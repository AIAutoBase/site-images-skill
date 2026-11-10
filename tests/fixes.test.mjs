// Tests for the final-review findings.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { tempDir } from "./helpers.mjs";
import { detectImageDir } from "../skill/scripts/lib/project.mjs";

const CLI = path.resolve("skill/scripts/site-images.mjs");
const sharp = createRequire(new URL("../skill/package.json", import.meta.url))("sharp");

function ctx(providers = { cloudflare: true }, slot = "hero", name = "Hero Coffee Shop") {
  const home = tempDir("home");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ providers }));
  fs.writeFileSync(path.join(home, ".env"), "CF_ACCOUNT_ID=a\nCF_API_TOKEN=t\n");
  const root = tempDir("proj");
  const brief = path.join(root, `${name}.json`);
  fs.writeFileSync(brief, JSON.stringify({ projectRoot: root, slot, filename: name, purpose: "p", subject: "s", place: "pl", style: "st" }));
  return { home, root, brief };
}
const env = (c, extra = {}) => ({ ...process.env, SITE_IMAGES_HOME: c.home, SITE_IMAGES_PROVIDER_OVERRIDE: "fake", SITE_IMAGES_FAKE_FAIL: "", ...extra });
const run = (c, args, extra) => {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8", env: env(c, extra) });
  return { code: r.status, out: r.stdout.trim() ? JSON.parse(r.stdout) : null, err: r.stderr };
};

test("I1: status works before npm install (sharp not loaded at startup)", () => {
  const copy = tempDir("nomods");
  fs.cpSync(path.resolve("skill"), copy, { recursive: true, filter: (src) => !src.includes("node_modules") });
  const r = spawnSync(process.execPath, [path.join(copy, "scripts", "site-images.mjs"), "status"], { encoding: "utf8", env: { ...process.env, SITE_IMAGES_HOME: tempDir("h") } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(JSON.parse(r.stdout).configured);
});

test("I3: a project with static/ gets static/images", () => {
  const root = tempDir("flask");
  fs.mkdirSync(path.join(root, "static"));
  assert.equal(detectImageDir(root), "static/images");
});

test("I3: finalize saves imageDir so later images stay in the same folder", async () => {
  const c = ctx();
  const cand = path.join(c.root, "cand.png");
  fs.writeFileSync(cand, await sharp({ create: { width: 512, height: 512, channels: 3, background: "#abc" } }).png().toBuffer());
  run(c, ["finalize", "--brief", c.brief, "--candidate", cand, "--provider", "cloudflare"]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(c.root, "site-images.json"), "utf8")).imageDir, "images");
  fs.mkdirSync(path.join(c.root, "public"));
  assert.equal(detectImageDir(c.root), "images");
});

test("I4: parallel finalizes keep every log entry", async () => {
  const c = ctx();
  const cand = path.join(c.root, "cand.png");
  fs.writeFileSync(cand, await sharp({ create: { width: 512, height: 512, channels: 3, background: "#abc" } }).png().toBuffer());
  const briefs = Array.from({ length: 6 }, (_, i) => {
    const b = path.join(c.root, `b${i}.json`);
    fs.writeFileSync(b, JSON.stringify({ projectRoot: c.root, slot: "card", filename: `card-${i}`, purpose: "p", subject: "s", place: "pl", style: "st" }));
    return b;
  });
  const codes = await Promise.all(briefs.map((b) => new Promise((resolve) => {
    spawn(process.execPath, [CLI, "finalize", "--brief", b, "--candidate", cand, "--provider", "cloudflare"], { env: env(c) }).on("exit", resolve);
  })));
  assert.deepEqual(codes, [0, 0, 0, 0, 0, 0]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(c.root, "site-images.json"), "utf8")).log.length, 6);
});

test("I5: a browser provider crashing with a plain error falls back to cloudflare", () => {
  const c = ctx({ cloudflare: true, chatgpt: true });
  const r = run(c, ["generate", "--brief", c.brief, "--attempt", "1", "--provider", "chatgpt"], { SITE_IMAGES_FAKE_FAIL: "chatgpt:crash" });
  assert.equal(r.code, 0, r.err + JSON.stringify(r.out));
  assert.equal(r.out.provider, "cloudflare");
  assert.equal(r.out.fellBackFrom, "chatgpt");
});

test("I5: a browser provider with its helper missing falls back to cloudflare", () => {
  const c = ctx({ cloudflare: true, chatgpt: true });
  const r = run(c, ["generate", "--brief", c.brief, "--attempt", "1", "--provider", "chatgpt"], { SITE_IMAGES_FAKE_FAIL: "chatgpt:config" });
  assert.equal(r.code, 0, r.err + JSON.stringify(r.out));
  assert.equal(r.out.provider, "cloudflare");
});

test("I5: cloudflare offline (plain error) with nothing to fall back to exits 5, not 1", () => {
  const c = ctx();
  const r = run(c, ["generate", "--brief", c.brief, "--attempt", "1"], { SITE_IMAGES_FAKE_FAIL: "cloudflare:crash" });
  assert.equal(r.code, 5);
});
