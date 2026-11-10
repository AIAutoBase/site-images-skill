import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cropResize } from "../skill/scripts/lib/image.mjs";

const sharp = createRequire(new URL("../skill/package.json", import.meta.url))("sharp");
const square = (n) => sharp({ create: { width: n, height: n, channels: 3, background: "#c96" } }).png().toBuffer();

test("cropResize 1024x1024 to 16:9 at width 1920 gives 1024x576 (no upscale)", async () => {
  const r = await cropResize(await square(1024), "16:9", 1920);
  assert.deepEqual([r.width, r.height], [1024, 576]);
});

test("cropResize 1024x1024 to 4:3 at width 800 gives 800x600", async () => {
  const r = await cropResize(await square(1024), "4:3", 800);
  assert.deepEqual([r.width, r.height], [800, 600]);
});

test("cropResize writes webp by default and png on request", async () => {
  const webp = await cropResize(await square(256), "1:1", 256);
  assert.equal(webp.buffer.toString("ascii", 8, 12), "WEBP");
  const png = await cropResize(await square(256), "1:1", 256, "png");
  assert.equal(png.buffer[0], 0x89);
});

test("cropResize handles 1.91:1", async () => {
  const r = await cropResize(await square(1024), "1.91:1", 1200);
  assert.deepEqual([r.width, r.height], [1024, 536]);
});
