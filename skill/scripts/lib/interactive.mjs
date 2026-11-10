// Commands the student runs in their own terminal: setup, login, test.
// Plain-text output (not JSON). Secrets are typed here, never pasted into the chat.
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { homeDir, readConfig, writeConfig, writeEnv } from "./home.mjs";
import { loadProvider } from "./load-provider.mjs";
import { ProviderError, ConfigError } from "./errors.mjs";

const BROWSER_WARNING = [
  "Heads-up about ChatGPT and Gemini:",
  "  - They work by driving your own logged-in browser, so they break when those sites change their layout.",
  "  - Automating them is a grey area under their terms of use.",
  "  - Cloudflare is the safe, stable path. Use these as extras.",
].join("\n");

function makeAsker() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
  const lines = rl[Symbol.asyncIterator]();
  const realWrite = rl._writeToOutput?.bind(rl);
  return {
    async ask(question, { hidden = false } = {}) {
      process.stdout.write(question);
      if (hidden && process.stdin.isTTY) rl._writeToOutput = () => {};
      const { value } = await lines.next();
      if (hidden && process.stdin.isTTY) { rl._writeToOutput = realWrite; process.stdout.write("\n"); }
      return (value ?? "").trim();
    },
    close: () => rl.close(),
  };
}

const yes = (answer) => /^y(es)?$/i.test(answer);

export async function login(_opts, positionals) {
  const which = positionals.find((p) => p === "chatgpt" || p === "gemini");
  if (!which) throw new ConfigError('Say which one: "login chatgpt" or "login gemini"');
  const { SITE } = await import(`../providers/${which}.mjs`);
  const { loginInteractive } = await import("../providers/browser.mjs");
  const result = await loginInteractive(SITE);
  const config = readConfig();
  config.providers[which] = result.ok;
  if (result.ok) config.browserChannel = result.channel;
  writeConfig(config);
  console.log(result.ok ? `${SITE.label}: logged in and saved on this computer only.` : `${SITE.label}: login not finished. Run "login ${which}" again when ready.`);
  return result.ok;
}

export async function testProviders() {
  const { providers } = readConfig();
  const enabled = Object.keys(providers).filter((p) => providers[p]);
  if (!enabled.length) {
    console.log("Nothing is set up yet. Run: setup");
    process.exitCode = 4;
    return;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "site-images-test-"));
  let anyOk = false;
  console.log("provider     result");
  for (const name of enabled) {
    try {
      const buf = await (await loadProvider(name)).generate({ prompt: "a small red apple on a white table, product photo", aspect: "1:1", width: 512 });
      fs.writeFileSync(path.join(dir, `${name}.img`), buf);
      anyOk = true;
      console.log(`${name.padEnd(12)} ok`);
    } catch (e) {
      const reason = e instanceof ProviderError || e instanceof ConfigError ? e.message : `unexpected error: ${e.message}`;
      console.log(`${name.padEnd(12)} failed - ${reason}`);
    }
  }
  process.exitCode = anyOk ? 0 : 5;
}

export async function setup() {
  const asker = makeAsker();
  try {
    console.log("site-images setup. Your answers are saved only on this computer, in " + homeDir());
    console.log("Cloudflare (free). Steps to get these two values: see references/setup-guide.md in the skill folder.");
    console.log("Press Enter to skip Cloudflare.");
    const accountId = await asker.ask("Cloudflare Account ID: ");
    const token = await asker.ask("Cloudflare API token (typing is hidden, Enter to skip): ", { hidden: true });
    const config = readConfig();
    if (accountId && token) {
      writeEnv({ CF_ACCOUNT_ID: accountId, CF_API_TOKEN: token });
      config.providers.cloudflare = true;
      console.log("Cloudflare saved.");
    } else {
      console.log("Cloudflare skipped.");
    }
    writeConfig(config);

    const wantChatgpt = yes(await asker.ask("Do you have ChatGPT Plus? (y/N): "));
    const wantGemini = yes(await asker.ask("Do you have Google AI Pro? (y/N): "));
    asker.close();
    if (wantChatgpt || wantGemini) console.log(BROWSER_WARNING);
    if (wantChatgpt) await login({}, ["chatgpt"]);
    if (wantGemini) await login({}, ["gemini"]);

    console.log("Testing each image maker you set up...");
    await testProviders();
    process.exitCode = 0;
  } finally {
    asker.close();
  }
}
