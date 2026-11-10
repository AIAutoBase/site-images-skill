import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "./helpers.mjs";
import { detectImageDir, readProject, writeProject, targetPath } from "../skill/scripts/lib/project.mjs";

test("detectImageDir prefers existing public/images", () => {
  const root = tempDir("proj");
  fs.mkdirSync(path.join(root, "public", "images"), { recursive: true });
  fs.mkdirSync(path.join(root, "images"));
  assert.equal(detectImageDir(root), "public/images");
});

test("detectImageDir uses public/images when only public/ exists", () => {
  const root = tempDir("proj");
  fs.mkdirSync(path.join(root, "public"));
  assert.equal(detectImageDir(root), "public/images");
});

test("detectImageDir falls back to images/ when nothing exists", () => {
  assert.equal(detectImageDir(tempDir("proj")), "images");
});

test("detectImageDir honours imageDir saved in site-images.json", () => {
  const root = tempDir("proj");
  writeProject(root, { imageDir: "web/pics", log: [] });
  assert.equal(detectImageDir(root), "web/pics");
});

test("readProject returns empty log when file absent", () => {
  assert.deepEqual(readProject(tempDir("proj")), { log: [] });
});

test("targetPath adds -2 for a foreign file", () => {
  const root = tempDir("proj");
  fs.mkdirSync(path.join(root, "images"));
  fs.writeFileSync(path.join(root, "images", "hero.webp"), "theirs");
  assert.equal(targetPath(root, "hero.webp"), path.join(root, "images", "hero-2.webp"));
  fs.writeFileSync(path.join(root, "images", "hero-2.webp"), "theirs too");
  assert.equal(targetPath(root, "hero.webp"), path.join(root, "images", "hero-3.webp"));
});

test("targetPath reuses path for a logged file", () => {
  const root = tempDir("proj");
  fs.mkdirSync(path.join(root, "images"));
  fs.writeFileSync(path.join(root, "images", "hero.webp"), "ours");
  writeProject(root, { log: [{ path: "images/hero.webp" }] });
  assert.equal(targetPath(root, "hero.webp"), path.join(root, "images", "hero.webp"));
});

test("targetPath creates the folder under a root with spaces and ñ", () => {
  const root = tempDir("proj");
  const p = targetPath(root, "card-latte.webp");
  assert.ok(fs.existsSync(path.dirname(p)));
  assert.match(p, /site images ñ/);
});
