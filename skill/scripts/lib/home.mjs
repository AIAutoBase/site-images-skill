// Where secrets, settings and browser sessions live: ~/.site-images/ (never the skill folder).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigError } from "./errors.mjs";
import { DEFAULT_CF_MODEL } from "./models.mjs";

export const homeDir = () => process.env.SITE_IMAGES_HOME ?? path.join(os.homedir(), ".site-images");
const envPath = () => path.join(homeDir(), ".env");
const configPath = () => path.join(homeDir(), "config.json");

export function readEnv() {
  if (!fs.existsSync(envPath())) return {};
  const out = {};
  for (const raw of fs.readFileSync(envPath(), "utf8").split("\n")) {
    const line = raw.replace(/\r$/, "").trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const value = line.slice(i + 1).trim().replace(/^(["'])(.*)\1$/, "$2").trim();
    out[line.slice(0, i).trim()] = value;
  }
  return out;
}

export function writeEnv(values) {
  fs.mkdirSync(homeDir(), { recursive: true });
  const merged = { ...readEnv(), ...values };
  fs.writeFileSync(envPath(), Object.entries(merged).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
  try { fs.chmodSync(envPath(), 0o600); } catch { /* Windows: no-op */ }
}

export function readConfig() {
  const defaults = { providers: { cloudflare: false, chatgpt: false, gemini: false }, cfModel: DEFAULT_CF_MODEL };
  if (!fs.existsSync(configPath())) return defaults;
  const saved = JSON.parse(fs.readFileSync(configPath(), "utf8"));
  return { ...defaults, ...saved, providers: { ...defaults.providers, ...saved.providers } };
}

export function writeConfig(config) {
  fs.mkdirSync(homeDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2) + "\n");
}

export function requireCloudflare() {
  const env = readEnv();
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) {
    throw new ConfigError("Cloudflare is not set up. Run: node <skill folder>/scripts/site-images.mjs setup");
  }
  return { accountId: env.CF_ACCOUNT_ID, token: env.CF_API_TOKEN };
}
