// Cloudflare Workers AI (free daily allowance). Auth: scoped API token, Bearer.
import { requireCloudflare, readConfig } from "../lib/home.mjs";
import { MODELS } from "../lib/models.mjs";
import { aspectRatio } from "../lib/slots.mjs";
import { ConfigError, ProviderError, QuotaError } from "../lib/errors.mjs";

export const name = "cloudflare";
const round16 = (n) => Math.max(256, Math.round(n / 16) * 16);

export async function generate({ prompt, aspect, width }, { fetch = globalThis.fetch } = {}) {
  const { accountId, token } = requireCloudflare();
  const model = readConfig().cfModel;
  const spec = MODELS[model];
  if (!spec) throw new ConfigError(`Unknown Cloudflare model "${model}" in config.json`);

  let body;
  const headers = { Authorization: `Bearer ${token}` };
  if (spec.body === "multipart") {
    body = new FormData();
    body.append("prompt", prompt);
    if (spec.sizes === "width-height") {
      body.append("width", String(round16(width)));
      body.append("height", String(round16(width / aspectRatio(aspect))));
    }
  } else {
    body = JSON.stringify({ prompt, steps: 4 });
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, { method: "POST", headers, body });
  if (res.status === 401 || res.status === 403) throw new ConfigError("Cloudflare token rejected. Run setup again.");
  let json;
  try { json = await res.json(); } catch { throw new ProviderError(`Cloudflare returned HTTP ${res.status} with no JSON`, { provider: name }); }
  const message = (json.errors ?? []).map((e) => e.message).join("; ");
  if (res.status === 429 || /allocation|neurons|quota/i.test(message)) {
    throw new QuotaError(`Cloudflare daily free images used up (${message || "HTTP 429"})`, { provider: name });
  }
  if (!res.ok || !json.success || !json.result?.image) {
    throw new ProviderError(`Cloudflare failed: ${message || `HTTP ${res.status}`}`, { provider: name });
  }
  return Buffer.from(json.result.image, "base64");
}
