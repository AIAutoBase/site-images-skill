import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useHome } from "./helpers.mjs";
import { writeEnv, writeConfig, readConfig } from "../skill/scripts/lib/home.mjs";
import { generate } from "../skill/scripts/providers/cloudflare.mjs";
import { createFake } from "../skill/scripts/providers/fake.mjs";
import { QuotaError, ProviderError, ConfigError, SessionError } from "../skill/scripts/lib/errors.mjs";

const job = { prompt: "a cafe", aspect: "16:9", width: 1920 };
const reply = (status, body) => async (url, init) => {
  reply.last = { url, init };
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
};
const ok = reply(200, { success: true, result: { image: Buffer.from([1, 2, 3, 4]).toString("base64") } });

beforeEach(() => { useHome(); writeEnv({ CF_ACCOUNT_ID: "acc", CF_API_TOKEN: "tok" }); });

test("sends Bearer token, never X-Auth-Key", async () => {
  await generate(job, { fetch: ok });
  const h = reply.last.init.headers;
  assert.equal(h.Authorization, "Bearer tok");
  assert.equal(h["X-Auth-Key"], undefined);
  assert.match(reply.last.url, /accounts\/acc\/ai\/run\/@cf\/black-forest-labs\/flux-2-klein-4b$/);
});

test("klein sends width and height as multipart, height rounded to 16", async () => {
  await generate(job, { fetch: ok });
  const body = reply.last.init.body;
  assert.ok(body instanceof FormData);
  assert.equal(body.get("width"), "1920");
  assert.equal(body.get("height"), "1088");
  assert.equal(body.get("prompt"), "a cafe");
});

test("schnell sends JSON without sizes", async () => {
  writeConfig({ ...readConfig(), cfModel: "@cf/black-forest-labs/flux-1-schnell" });
  await generate(job, { fetch: ok });
  const body = JSON.parse(reply.last.init.body);
  assert.equal(body.prompt, "a cafe");
  assert.equal(body.width, undefined);
});

test("returns decoded image bytes", async () => {
  assert.deepEqual([...(await generate(job, { fetch: ok }))], [1, 2, 3, 4]);
});

test("429 throws QuotaError", async () => {
  await assert.rejects(generate(job, { fetch: reply(429, { success: false, errors: [{ message: "Too many" }] }) }), QuotaError);
});

test("daily allocation error body throws QuotaError", async () => {
  const body = { success: false, errors: [{ code: 3036, message: "you have used up your daily free allocation of 10,000 neurons" }] };
  await assert.rejects(generate(job, { fetch: reply(400, body) }), QuotaError);
});

test("200 with success:false throws ProviderError", async () => {
  await assert.rejects(generate(job, { fetch: reply(200, { success: false, errors: [{ message: "boom" }] }) }),
    (e) => e instanceof ProviderError && !(e instanceof QuotaError) && e.technical);
});

test("401 throws ConfigError mentioning setup", async () => {
  await assert.rejects(generate(job, { fetch: reply(401, { success: false }) }), (e) => e instanceof ConfigError && /setup/.test(e.message));
});

test("fake returns a 1024 PNG and fails only for its own provider", async () => {
  process.env.SITE_IMAGES_FAKE_FAIL = "chatgpt:session";
  const png = await createFake("cloudflare").generate(job);
  assert.equal(png[0], 0x89);
  await assert.rejects(createFake("chatgpt").generate(job), SessionError);
  delete process.env.SITE_IMAGES_FAKE_FAIL;
});
