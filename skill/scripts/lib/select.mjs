// Which generator makes this image. Cloudflare unless there's a reason not to.
import { MODELS } from "./models.mjs";
import { SLOTS } from "./slots.mjs";

export const BROWSER_PROVIDERS = ["chatgpt", "gemini"];

export function chooseProvider(brief, config, { requested, pinned } = {}) {
  if (pinned) return pinned;
  const on = config.providers;
  if (requested && on[requested]) return requested;
  const browser = BROWSER_PROVIDERS.find((p) => on[p]);
  if (!on.cloudflare && browser) return browser;
  const fixedSquare = MODELS[config.cfModel]?.sizes === "fixed-1024";
  if (browser && (brief.inImageText || (fixedSquare && SLOTS[brief.slot]?.aspect !== "1:1"))) return browser;
  return "cloudflare";
}
