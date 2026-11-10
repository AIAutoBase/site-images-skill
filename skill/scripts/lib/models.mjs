// Cloudflare Workers AI image models this skill knows how to call.
// klein-4b: Apache 2.0, accepts width/height (multipart). schnell: fixed 1024 (JSON).
export const MODELS = {
  "@cf/black-forest-labs/flux-2-klein-4b": { sizes: "width-height", body: "multipart" },
  "@cf/black-forest-labs/flux-1-schnell": { sizes: "fixed-1024", body: "json" },
};
export const DEFAULT_CF_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";
