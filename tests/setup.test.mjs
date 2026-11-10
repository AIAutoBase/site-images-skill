import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tempDir } from "./helpers.mjs";

const CLI = path.resolve("skill/scripts/site-images.mjs");
const run = (home, args, input, env = {}) => spawnSync(process.execPath, [CLI, ...args], {
  input, encoding: "utf8",
  env: { ...process.env, SITE_IMAGES_HOME: home, SITE_IMAGES_PROVIDER_OVERRIDE: "fake", SITE_IMAGES_FAKE_FAIL: "", ...env },
});

test("setup with piped answers writes trimmed .env, enables cloudflare, never echoes the token", () => {
  const home = tempDir("home");
  const r = run(home, ["setup"], "acc-123\n  SECRETVALUE123  \nn\nn\n");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(path.join(home, ".env"), "utf8"), /^CF_API_TOKEN=SECRETVALUE123$/m);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, "config.json"), "utf8")).providers.cloudflare, true);
  assert.doesNotMatch(r.stdout + r.stderr, /SECRETVALUE123/);
  assert.match(r.stdout, /cloudflare\s+ok/i);
});

test("setup skipping Cloudflare leaves it disabled", () => {
  const home = tempDir("home");
  const r = run(home, ["setup"], "\n\nn\nn\n");
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, "config.json"), "utf8")).providers.cloudflare, false);
});

test("test command with fake provider prints ok row", () => {
  const home = tempDir("home");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ providers: { cloudflare: true } }));
  const r = run(home, ["test"]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /cloudflare\s+ok/i);
});

test("test command reports failure reason and exits 5 when nothing works", () => {
  const home = tempDir("home");
  fs.writeFileSync(path.join(home, "config.json"), JSON.stringify({ providers: { cloudflare: true } }));
  const r = run(home, ["test"], "", { SITE_IMAGES_FAKE_FAIL: "cloudflare:quota" });
  assert.equal(r.status, 5);
  assert.match(r.stdout, /cloudflare\s+failed/i);
});

// --- browser providers against local fixture pages ---
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pages = {
  "/chatgpt-out/": `<button data-testid="login-button">Log in</button>`,
  "/broken/": `<p>Something else entirely</p>`,
  "/gemini-slow/": `<a aria-label="Google Account: T" href="#">me</a><rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea><main></main>
    <script>document.addEventListener("keydown",e=>{if(e.key==="Enter"){const g=document.createElement("single-image");const i=document.createElement("img");i.className="image";g.append(i);document.querySelector("main").append(g);setTimeout(()=>{i.src="${PIXEL}";i.classList.add("loaded")},800)}})</script>`,
  "/gemini-guest/": `<rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea>`,
  "/chatgpt-in/": `<button aria-label="Open profile menu">me</button><main><div id="prompt-textarea" contenteditable="true"></div></main>
    <script>document.addEventListener("keydown",e=>{if(e.key==="Enter"){setTimeout(()=>{const i=document.createElement("img");i.alt="Generated image";i.src="${PIXEL}";document.querySelector("main").append(i)},300)}})</script>`,
  "/gemini-in/": `<a aria-label="Google Account: Test (t@example.com)" href="#">me</a><rich-textarea><div class="ql-editor" contenteditable="true"></div></rich-textarea><main></main>
    <script>document.addEventListener("keydown",e=>{if(e.key==="Enter"){setTimeout(()=>{const g=document.createElement("generated-image");const i=document.createElement("img");i.src="${PIXEL}";g.append(i);document.querySelector("main").append(g)},300)}})</script>`,
};
let server, base;
before(async () => {
  server = http.createServer((req, res) => { res.setHeader("content-type", "text/html"); res.end(pages[req.url] ?? "404"); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections?.(); server.close(); });

async function gen(provider, route) {
  process.env.SITE_IMAGES_HOME = tempDir("home");
  process.env.SITE_IMAGES_BROWSER_BASE_URL = base + route;
  process.env.SITE_IMAGES_BROWSER_TIMEOUT_MS = "3000";
  process.env.SITE_IMAGES_BROWSER_HEADLESS = "1";
  process.env.SITE_IMAGES_PLAYWRIGHT_FROM = path.resolve("package.json");
  const mod = await import(`../skill/scripts/providers/${provider}.mjs`);
  return mod.generate({ prompt: "a cafe", aspect: "1:1", width: 512 });
}

test("chatgpt generate on a logged-out page throws SessionError", async () => {
  const { SessionError } = await import("../skill/scripts/lib/errors.mjs");
  await assert.rejects(gen("chatgpt", "/chatgpt-out/"), (e) => e instanceof SessionError && /log in again/i.test(e.message));
});

test("chatgpt generate on an unrecognised page throws PageChangedError", async () => {
  const { PageChangedError } = await import("../skill/scripts/lib/errors.mjs");
  await assert.rejects(gen("chatgpt", "/broken/"), PageChangedError);
});

test("chatgpt generate returns the image bytes from a logged-in page", async () => {
  const buf = await gen("chatgpt", "/chatgpt-in/");
  assert.equal(buf[0], 0x89);
});

test("gemini generate returns the image bytes from a logged-in page", async () => {
  const buf = await gen("gemini", "/gemini-in/");
  assert.equal(buf[0], 0x89);
});

test("browser provider without the helper installed asks to run login", async () => {
  const { ConfigError } = await import("../skill/scripts/lib/errors.mjs");
  process.env.SITE_IMAGES_HOME = tempDir("home");
  delete process.env.SITE_IMAGES_PLAYWRIGHT_FROM;
  const mod = await import("../skill/scripts/providers/chatgpt.mjs");
  await assert.rejects(mod.generate({ prompt: "x", aspect: "1:1", width: 512 }), (e) => e instanceof ConfigError && /login chatgpt/.test(e.message));
});

test("a guest page with a chat box but no account is not treated as logged in", async () => {
  process.env.SITE_IMAGES_PLAYWRIGHT_FROM = path.resolve("package.json");
  const { pageState } = await import("../skill/scripts/providers/browser.mjs");
  const { SITE } = await import("../skill/scripts/providers/gemini.mjs");
  const pw = (await import("node:module")).createRequire(path.resolve("package.json"))("playwright");
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base + "/gemini-guest/");
    assert.notEqual(await pageState(page, SITE, 1500), "in");
    await page.goto(base + "/gemini-in/");
    assert.equal(await pageState(page, SITE, 1500), "in");
  } finally {
    await browser.close();
  }
});

test("gemini waits for the image to finish loading before downloading it", async () => {
  const buf = await gen("gemini", "/gemini-slow/");
  assert.equal(buf[0], 0x89);
});
