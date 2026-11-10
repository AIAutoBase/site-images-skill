import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fresh temp dir; name includes a space and ñ so every test covers awkward paths.
export function tempDir(label = "tmp") {
  return fs.mkdtempSync(path.join(os.tmpdir(), `site images ñ ${label}-`));
}

export function useHome() {
  const dir = tempDir("home");
  process.env.SITE_IMAGES_HOME = dir;
  return dir;
}
