import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { useHome } from "./helpers.mjs";
import { homeDir, readEnv, writeEnv, readConfig, requireCloudflare } from "../skill/scripts/lib/home.mjs";
import { ConfigError } from "../skill/scripts/lib/errors.mjs";

test("readEnv trims and unquotes", () => {
  const home = useHome();
  fs.writeFileSync(path.join(home, ".env"), 'CF_ACCOUNT_ID = "abc" \r\nCF_API_TOKEN=tok  \n# comment\n');
  assert.deepEqual(readEnv(), { CF_ACCOUNT_ID: "abc", CF_API_TOKEN: "tok" });
});

test("readEnv missing file returns {}", () => {
  useHome();
  assert.deepEqual(readEnv(), {});
});

test("requireCloudflare throws ConfigError mentioning setup when token blank", () => {
  const home = useHome();
  fs.writeFileSync(path.join(home, ".env"), "CF_ACCOUNT_ID=abc\nCF_API_TOKEN=   \n");
  assert.throws(() => requireCloudflare(), (e) => e instanceof ConfigError && /setup/.test(e.message));
});

test("requireCloudflare returns trimmed values", () => {
  const home = useHome();
  fs.writeFileSync(path.join(home, ".env"), "CF_ACCOUNT_ID=abc\nCF_API_TOKEN='tok'\n");
  assert.deepEqual(requireCloudflare(), { accountId: "abc", token: "tok" });
});

test("writeEnv merges and keeps other keys", () => {
  useHome();
  writeEnv({ A: "1", B: "2" });
  writeEnv({ B: "3" });
  assert.deepEqual(readEnv(), { A: "1", B: "3" });
});

test("readConfig returns defaults when absent", () => {
  useHome();
  const c = readConfig();
  assert.deepEqual(c.providers, { cloudflare: false, chatgpt: false, gemini: false });
  assert.equal(c.cfModel, "@cf/black-forest-labs/flux-2-klein-4b");
});

test("homeDir respects SITE_IMAGES_HOME with spaces and ñ", () => {
  const home = useHome();
  assert.equal(homeDir(), home);
  assert.match(homeDir(), /site images ñ/);
});
