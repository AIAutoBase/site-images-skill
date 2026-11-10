// Fails if the shipped skill folder contains anything personal or secret.
// Usage: node scripts/grep-gate.mjs skill/
import fs from "node:fs";
import path from "node:path";

const BANNED = ["G:/", "G:\\", "C:\\Users", "rough", "hector", "orbix", "aiautobase", "AI Auto Base",
  "10.0.", "192.168.", ".browser-profiles", "CF_API_KEY", "X-Auth-Key", "sk-", "AIza"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);

function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(p); else yield p;
  }
}

const root = process.argv[2] ?? "skill";
const hits = [];
for (const file of files(root)) {
  const text = fs.readFileSync(file, "utf8").toLowerCase();
  for (const word of BANNED) {
    const w = word.toLowerCase();
    // Plain words match whole words only ("rough" must not match "through").
    const hit = /^[a-z ]+$/.test(w) ? new RegExp(`\\b${w}\\b`).test(text) : text.includes(w);
    if (hit) hits.push(`${file}: ${word}`);
  }
}
if (hits.length) { console.log(hits.join("\n")); process.exit(1); }
console.log(`grep gate: clean (${root})`);
