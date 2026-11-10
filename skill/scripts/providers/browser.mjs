// Drives the student's own logged-in ChatGPT / Gemini tab with Playwright.
// Sessions live in ~/.site-images/browser-profiles/<provider>/ (never in the skill folder).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { homeDir, readConfig } from "../lib/home.mjs";
import { ConfigError, SessionError, PageChangedError, ProviderError } from "../lib/errors.mjs";

const runtimeDir = () => path.join(homeDir(), "runtime");
export const profileDir = (provider) => path.join(homeDir(), "browser-profiles", provider);
const LAUNCH_ARGS = ["--disable-blink-features=AutomationControlled"];

// Only our own runtime copy. Normal resolution would walk up parent folders and
// pick whatever stale Playwright lives there (e.g. ~/node_modules).
// SITE_IMAGES_PLAYWRIGHT_FROM (tests only) points at a package.json to resolve from.
function loadPlaywright() {
  const from = process.env.SITE_IMAGES_PLAYWRIGHT_FROM
    ?? (fs.existsSync(path.join(runtimeDir(), "node_modules", "playwright")) ? path.join(runtimeDir(), "package.json") : null);
  if (!from) return null;
  try { return createRequire(from)("playwright"); } catch { return null; }
}

// Installs Playwright + Chromium into ~/.site-images/runtime on first use.
export function ensurePlaywright(log = console.log) {
  const found = loadPlaywright();
  if (found) return found;
  fs.mkdirSync(runtimeDir(), { recursive: true });
  const pkg = path.join(runtimeDir(), "package.json");
  if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, '{ "private": true }\n');
  log("Installing the browser helper (one time, about 150 MB)...");
  const opts = { cwd: runtimeDir(), stdio: "inherit", shell: process.platform === "win32" };
  if (spawnSync("npm", ["install", "playwright", "--no-fund", "--no-audit"], opts).status !== 0) {
    throw new ConfigError("Could not install Playwright (npm install failed).");
  }
  if (spawnSync("npx", ["playwright", "install", "chromium"], opts).status !== 0) {
    throw new ConfigError("Could not install the Chromium browser for Playwright.");
  }
  return loadPlaywright();
}

async function openContext(provider, { headless }) {
  const pw = loadPlaywright();
  if (!pw) throw new ConfigError(`The browser helper is not installed. Run: node <skill folder>/scripts/site-images.mjs login ${provider}`);
  fs.mkdirSync(profileDir(provider), { recursive: true });
  const channel = readConfig().browserChannel;
  return pw.chromium.launchPersistentContext(profileDir(provider), {
    headless,
    ...(channel && channel !== "chromium" && { channel }),
    viewport: { width: 1280, height: 900 },
    // Hidden browsers get a "Just a moment..." bot check on chatgpt.com, so we use a
    // real window parked off-screen instead.
    args: headless ? LAUNCH_ARGS : [...LAUNCH_ARGS, "--window-position=-2400,-2400", "--window-size=1280,900"],
  });
}

function timeouts() {
  const t = Number(process.env.SITE_IMAGES_BROWSER_TIMEOUT_MS);
  return t > 0 ? { detect: t, generate: t } : { detect: 30_000, generate: 240_000 };
}

// "in" = account visible and composer ready, "out" = sign-in link present,
// null = unrecognised page. Both sites let guests chat, so a composer alone
// proves nothing: "in" needs the account button (selectors.loggedIn).
export async function pageState(page, site, waitMs) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (await page.locator(site.selectors.loginSignal).count()) return "out";
    const composer = await page.locator(site.selectors.composer).first().isVisible().catch(() => false);
    if (composer && (await page.locator(site.selectors.loggedIn).count())) return "in";
    await page.waitForTimeout(250);
  }
  return null;
}

export async function generateInBrowser(site, { prompt, aspect }) {
  const t = timeouts();
  const headless = process.env.SITE_IMAGES_BROWSER_HEADLESS === "1" || readConfig().browserHeadless === true;
  const context = await openContext(site.name, { headless });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(process.env.SITE_IMAGES_BROWSER_BASE_URL ?? site.url, { waitUntil: "domcontentloaded" });
    const state = await pageState(page, site, t.detect);
    if (state === "out") {
      throw new SessionError(`${site.label} is logged out. Log in again: run "login ${site.name}" (or setup).`, { provider: site.name });
    }
    if (state !== "in") {
      throw new PageChangedError(`${site.label} page did not look as expected (the site may have changed).`, { provider: site.name });
    }

    const before = await page.locator(site.selectors.resultImage).count();
    const composer = page.locator(site.selectors.composer).first();
    await composer.click();
    await composer.fill(`${site.promptPrefix(aspect)}${prompt}`);
    await page.keyboard.press("Enter");

    try {
      await page.waitForFunction(
        ([sel, n]) => document.querySelectorAll(sel).length > n,
        [site.selectors.resultImage, before],
        { timeout: t.generate },
      );
    } catch {
      throw new PageChangedError(`${site.label} did not return an image in time.`, { provider: site.name });
    }
    if (site.selectors.stillGenerating) {
      await page.waitForSelector(site.selectors.stillGenerating, { state: "detached", timeout: t.generate }).catch(() => {});
    }
    // The image element often appears empty first; wait until the real picture has loaded.
    await page.waitForFunction((sel) => {
      const all = document.querySelectorAll(sel);
      const img = all[all.length - 1];
      return !!img && !!img.getAttribute("src") && img.complete && img.naturalWidth > 1;
    }, site.selectors.resultImage, { timeout: t.generate }).catch(() => {});
    const src = await page.locator(site.selectors.resultImage).last().getAttribute("src");
    if (!src) throw new PageChangedError(`${site.label} image had no address.`, { provider: site.name });
    // 1) fetch inside the page (session cookies apply); 2) copy the loaded picture
    // through a canvas (works for blob: images); 3) fetch with the browser's cookies
    // outside the page (no CORS limits).
    const b64 = await page.evaluate(async (sel) => {
      const all = document.querySelectorAll(sel);
      const img = all[all.length - 1];
      try {
        const res = await fetch(img.src);
        if (res.ok) {
          const blob = await res.blob();
          return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.readAsDataURL(blob);
          });
        }
      } catch { /* try the canvas */ }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        return canvas.toDataURL("image/png").split(",")[1];
      } catch { return null; }
    }, site.selectors.resultImage);
    if (b64) return Buffer.from(b64, "base64");
    if (/^https?:/.test(src)) {
      const res = await context.request.get(src);
      if (res.ok()) return Buffer.from(await res.body());
    }
    throw new ProviderError(`${site.label} image could not be downloaded.`, { provider: site.name });
  } finally {
    await context.close();
  }
}

// Opens a visible window so the student logs in once. Returns { ok, channel }.
export async function loginInteractive(site, { log = console.log, maxMinutes = 10 } = {}) {
  const pw = ensurePlaywright(log);
  fs.mkdirSync(profileDir(site.name), { recursive: true });
  let context;
  let channel = "chrome";
  try {
    // Installed Chrome first: Google often refuses sign-in from bundled Chromium.
    context = await pw.chromium.launchPersistentContext(profileDir(site.name), { headless: false, channel, viewport: null, args: LAUNCH_ARGS });
  } catch {
    channel = "chromium";
    context = await pw.chromium.launchPersistentContext(profileDir(site.name), { headless: false, viewport: null, args: LAUNCH_ARGS });
  }
  let closed = false;
  context.on("close", () => { closed = true; });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(site.url, { waitUntil: "domcontentloaded" });
    log(`A browser window opened. Log in to ${site.label} there. It closes by itself once you are in.`);
    const deadline = Date.now() + maxMinutes * 60_000;
    while (!closed && Date.now() < deadline) {
      if ((await pageState(page, site, 2000).catch(() => null)) === "in") {
        // Give the browser time to write the login cookies to disk before closing.
        log("Logged in. Saving your session (10 seconds)...");
        await page.waitForTimeout(10_000);
        return { ok: true, channel };
      }
    }
    return { ok: false, channel };
  } finally {
    if (!closed) await context.close().catch(() => {});
  }
}
