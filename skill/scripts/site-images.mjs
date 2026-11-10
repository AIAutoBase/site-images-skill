#!/usr/bin/env node
// site-images CLI. status/generate/finalize print one JSON object (for the Haiku worker);
// setup/login/test talk to the student in plain text.
// Exit codes: 0 ok · 2 usage/bad brief · 3 max attempts · 4 config · 5 no provider worked.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { homeDir, readConfig } from "./lib/home.mjs";
import { validateBrief, buildPrompt } from "./lib/brief.mjs";
import { SLOTS } from "./lib/slots.mjs";
import { readProject, writeProject, targetPath, toPosix, detectImageDir, withProjectLock } from "./lib/project.mjs";
import { cropResize } from "./lib/image.mjs";
import { chooseProvider, BROWSER_PROVIDERS } from "./lib/select.mjs";
import { loadProvider } from "./lib/load-provider.mjs";
import { setup, login, testProviders } from "./lib/interactive.mjs";
import { ConfigError, ProviderError, QuotaError } from "./lib/errors.mjs";

export const MAX_ATTEMPTS = 2;

class Exit extends Error {
  constructor(code, payload) { super(payload.error ?? "exit"); this.code = code; this.payload = payload; }
}

function loadBrief(file) {
  if (!file) throw new Exit(2, { error: "--brief <file.json> is required" });
  let raw;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { throw new Exit(2, { error: `cannot read brief: ${e.message}` }); }
  try {
    const format = raw.projectRoot ? readProject(raw.projectRoot).format : undefined;
    return validateBrief(raw, format ?? "webp");
  } catch (e) { throw new Exit(2, { error: e.message }); }
}

function ensureGitignored(root) {
  const file = path.join(root, ".gitignore");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (/^\.site-images\/?\s*$/m.test(text)) return;
  fs.writeFileSync(file, text + (text && !text.endsWith("\n") ? "\n" : "") + ".site-images/\n");
}

// Any failure inside a provider is technical (offline, timeout, page changed, helper
// missing) so it falls back instead of crashing. Only a rejected Cloudflare token stays a setup error.
async function callProvider(name, job) {
  try {
    return await (await loadProvider(name)).generate(job);
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (e instanceof ConfigError && name === "cloudflare") throw e;
    throw new ProviderError(`${name}: ${String(e.message).split("\n")[0]}`, { provider: name });
  }
}

const extOf = (buf) => (buf[0] === 0x89 ? "png" : buf.toString("ascii", 8, 12) === "WEBP" ? "webp" : "jpg");

async function generate(opts) {
  const brief = loadBrief(opts.brief);
  const attempt = Number(opts.attempt ?? 1);
  if (attempt > MAX_ATTEMPTS) throw new Exit(3, { error: `max attempts reached (${MAX_ATTEMPTS})` });
  if (!Number.isInteger(attempt) || attempt < 1) throw new Exit(2, { error: "--attempt must be 1 or 2" });

  const config = readConfig();
  const prompt = buildPrompt(brief);
  const { aspect, width } = SLOTS[brief.slot];
  const job = { prompt, aspect, width };
  let provider = chooseProvider(brief, config, { requested: opts.provider, pinned: opts.pin });
  let image, fellBackFrom, fallbackReason;
  try {
    image = await callProvider(provider, job);
  } catch (e) {
    if (!(e instanceof ProviderError) || !e.technical) throw e;
    // Technical failure: not one of the two attempts. Try the other kind of provider once.
    const next = provider === "cloudflare" ? (e instanceof QuotaError ? BROWSER_PROVIDERS.find((p) => config.providers[p]) : undefined)
      : config.providers.cloudflare ? "cloudflare" : undefined;
    if (!next && e instanceof QuotaError && provider === "cloudflare") {
      throw new Exit(5, { error: "Cloudflare daily free images used up; try again tomorrow (resets 00:00 UTC) or enable ChatGPT/Gemini with setup", provider });
    }
    if (!next) throw new Exit(5, { error: e.message, provider });
    fellBackFrom = provider; fallbackReason = e.message; provider = next;
    try { image = await callProvider(provider, job); } catch (e2) {
      if (e2 instanceof ProviderError) throw new Exit(5, { error: `${fallbackReason}; then ${e2.message}`, provider });
      throw e2;
    }
  }

  const dir = path.join(brief.projectRoot, ".site-images", "candidates");
  fs.mkdirSync(dir, { recursive: true });
  const stem = brief.filename.replace(/\.[a-z]+$/, "");
  const file = path.join(dir, `${stem}.attempt-${attempt}.${extOf(image)}`);
  fs.writeFileSync(file, image);
  ensureGitignored(brief.projectRoot);
  return { candidate: toPosix(path.relative(brief.projectRoot, file)), provider, prompt, attempt, ...(fellBackFrom && { fellBackFrom, fallbackReason }) };
}

async function finalize(opts) {
  const brief = loadBrief(opts.brief);
  if (!opts.candidate) throw new Exit(2, { error: "--candidate <path> is required" });
  const root = brief.projectRoot;
  const candidate = path.resolve(root, opts.candidate);
  const project = readProject(root);
  const { aspect, width } = SLOTS[brief.slot];
  const out = await cropResize(fs.readFileSync(candidate), aspect, width, project.format === "png" ? "png" : "webp");
  const rel = await withProjectLock(root, () => {
    const dest = targetPath(root, brief.filename);
    fs.writeFileSync(dest, out.buffer);
    const relPath = toPosix(path.relative(root, dest));
    const fresh = readProject(root);
    const entry = { path: relPath, slot: brief.slot, provider: opts.provider, prompt: buildPrompt(brief), createdAt: new Date().toISOString() };
    writeProject(root, { ...fresh, imageDir: fresh.imageDir ?? detectImageDir(root), log: [...fresh.log.filter((e) => e.path !== relPath), entry] });
    return relPath;
  });
  ensureGitignored(root);
  return { path: rel, width: out.width, height: out.height };
}

function status() {
  return { configured: readConfig().providers, home: homeDir() };
}

export const COMMANDS = { status, generate, finalize, setup, login, test: testProviders };

async function main(argv) {
  const [command, ...rest] = argv;
  const { values } = parseArgs({
    args: rest, allowPositionals: true, strict: false,
    options: { brief: { type: "string" }, attempt: { type: "string" }, provider: { type: "string" }, pin: { type: "string" }, candidate: { type: "string" } },
  });
  const fn = COMMANDS[command];
  if (!fn) throw new Exit(2, { error: `unknown command "${command ?? ""}" (use: ${Object.keys(COMMANDS).join(", ")})` });
  return fn(values, rest);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (result) => { if (result !== undefined) console.log(JSON.stringify(result)); },
    (e) => {
      if (e instanceof Exit) { console.log(JSON.stringify(e.payload)); process.exit(e.code); }
      if (e instanceof ConfigError) { console.log(JSON.stringify({ error: e.message })); process.exit(4); }
      console.log(JSON.stringify({ error: e.message })); process.exit(1);
    },
  );
}
