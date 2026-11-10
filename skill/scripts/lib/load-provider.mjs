// Resolve a provider module by name. SITE_IMAGES_PROVIDER_OVERRIDE=fake is for tests only.
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { BROWSER_PROVIDERS } from "./select.mjs";

export const ALL_PROVIDERS = ["cloudflare", ...BROWSER_PROVIDERS];
const providersDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "providers");

export async function loadProvider(name) {
  if (process.env.SITE_IMAGES_PROVIDER_OVERRIDE === "fake") {
    const { createFake } = await import("../providers/fake.mjs");
    return createFake(name);
  }
  if (!ALL_PROVIDERS.includes(name)) throw new Error(`unknown provider "${name}" (use: ${ALL_PROVIDERS.join(", ")})`);
  return import(pathToFileURL(path.join(providersDir, `${name}.mjs`)).href);
}
