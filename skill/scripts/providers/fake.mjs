// Test-only provider. SITE_IMAGES_FAKE_FAIL="<provider>:<quota|session|page|config|crash>" makes that provider fail.
import { createRequire } from "node:module";
import { QuotaError, SessionError, PageChangedError, ConfigError } from "../lib/errors.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const FAILS = { quota: QuotaError, session: SessionError, page: PageChangedError, config: ConfigError, crash: Error };

export function createFake(providerName) {
  return {
    name: providerName,
    async generate() {
      const [who, mode] = (process.env.SITE_IMAGES_FAKE_FAIL ?? "").split(":");
      if (who === providerName && FAILS[mode]) throw new FAILS[mode](`fake ${mode} failure`, { provider: providerName });
      return sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#8a6" } }).png().toBuffer();
    },
  };
}
