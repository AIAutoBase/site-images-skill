// A brief is main Claude's order for one image. buildPrompt turns it into one
// English prompt in art-director order: subject, place, style, light, framing,
// format, what to avoid.
import { SLOTS, HEADLINE_SLOTS } from "./slots.mjs";

const REQUIRED = ["projectRoot", "slot", "filename", "purpose", "subject", "place", "style"];
const STANDARD_AVOID = ["garbled text", "deformed hands", "watermarks", "logos"];

export function validateBrief(brief, format = "webp") {
  for (const field of REQUIRED) {
    if (typeof brief[field] !== "string" || !brief[field].trim()) throw new Error(`brief is missing "${field}"`);
  }
  if (!SLOTS[brief.slot]) throw new Error(`unknown slot "${brief.slot}" (use: ${Object.keys(SLOTS).join(", ")})`);
  if (brief.inImageText && brief.inImageText.trim().split(/\s+/).length > 5) {
    throw new Error("in-image text max 5 words; put longer copy in HTML/CSS");
  }
  let avoid = brief.avoid ?? [];
  if (typeof avoid === "string") avoid = avoid.split(",").map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(avoid)) throw new Error('brief "avoid" must be a list of short phrases');
  const stem = brief.filename.trim().replace(/\.[a-z0-9]+$/i, "").toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!stem) throw new Error('brief "filename" has no usable characters');
  return { ...brief, avoid, filename: `${stem}.${format}` };
}

export function buildPrompt(brief) {
  const { aspect } = SLOTS[brief.slot];
  const parts = [brief.subject, brief.place, brief.style];
  if (brief.light) parts.push(brief.light);
  if (brief.framing) parts.push(brief.framing);
  if (HEADLINE_SLOTS.has(brief.slot)) parts.push("clear empty area for headline text");
  parts.push(`${aspect} aspect ratio`);
  parts.push(brief.inImageText ? `with the text "${brief.inImageText.trim()}"` : "no text");
  parts.push(`Avoid: ${[...STANDARD_AVOID, ...(brief.avoid ?? [])].join(", ")}`);
  return parts.map((p) => p.trim().replace(/\.$/, "")).join(". ") + ".";
}
