// The student's project: where images go, and site-images.json (style + log).
import fs from "node:fs";
import path from "node:path";

const CANDIDATES = ["public/images", "public/img", "src/assets/images", "src/assets", "static/images", "assets/images", "images"];
const projectFile = (root) => path.join(root, "site-images.json");
export const toPosix = (p) => p.split(path.sep).join("/");

export function readProject(root) {
  if (!fs.existsSync(projectFile(root))) return { log: [] };
  const p = JSON.parse(fs.readFileSync(projectFile(root), "utf8"));
  return { ...p, log: p.log ?? [] };
}

export function writeProject(root, project) {
  fs.writeFileSync(projectFile(root), JSON.stringify(project, null, 2) + "\n");
}

export function detectImageDir(root) {
  const saved = readProject(root).imageDir;
  if (saved) return saved;
  const found = CANDIDATES.find((c) => fs.existsSync(path.join(root, c)));
  if (found) return found;
  for (const served of ["public", "static"]) {
    if (fs.existsSync(path.join(root, served))) return `${served}/images`;
  }
  return "images";
}

// Serialise writers to site-images.json (parallel helpers finalize at the same time).
export async function withProjectLock(root, fn) {
  const lock = path.join(root, ".site-images", "lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const deadline = Date.now() + 20_000;
  for (;;) {
    try { fs.mkdirSync(lock); break; } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30_000) fs.rmSync(lock, { recursive: true, force: true }); } catch { /* gone */ }
      if (Date.now() > deadline) throw new Error("site-images.json is busy (another helper is writing). Try again.");
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 50));
    }
  }
  try { return await fn(); } finally { fs.rmSync(lock, { recursive: true, force: true }); }
}

// Never overwrite a file site-images didn't make; replace one it did.
export function targetPath(root, filename) {
  const dir = path.join(root, detectImageDir(root));
  fs.mkdirSync(dir, { recursive: true });
  const ours = new Set(readProject(root).log.map((e) => e.path));
  const ext = path.extname(filename);
  const stem = filename.slice(0, -ext.length);
  for (let n = 1; ; n++) {
    const candidate = path.join(dir, n === 1 ? filename : `${stem}-${n}${ext}`);
    if (!fs.existsSync(candidate) || ours.has(toPosix(path.relative(root, candidate)))) return candidate;
  }
}
