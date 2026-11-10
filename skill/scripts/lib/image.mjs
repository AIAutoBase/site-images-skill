// Center-crop to the slot's shape, shrink to the slot's width (never enlarge).
import { createRequire } from "node:module";
import { aspectRatio } from "./slots.mjs";

// Loaded on first use so status/setup work even before `npm install`.
let sharp;

export async function cropResize(input, aspect, width, format = "webp") {
  sharp ??= createRequire(import.meta.url)("sharp");
  const img = sharp(input);
  const { width: sw, height: sh } = await img.metadata();
  const ratio = aspectRatio(aspect);
  let cw = sw, ch = Math.round(sw / ratio);
  if (ch > sh) { ch = sh; cw = Math.round(sh * ratio); }
  const outW = Math.min(width, cw);
  const outH = Math.round(outW / ratio);
  const pipeline = img
    .extract({ left: Math.floor((sw - cw) / 2), top: Math.floor((sh - ch) / 2), width: cw, height: ch })
    .resize(outW, outH);
  const buffer = await (format === "png" ? pipeline.png() : pipeline.webp({ quality: 82 })).toBuffer();
  return { buffer, width: outW, height: outH };
}
