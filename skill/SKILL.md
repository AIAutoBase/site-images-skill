---
name: site-images
description: Images for the website or app being built in this project (hero, service cards, backgrounds, avatars, social/OG images) — generated, checked and saved straight into the project, named and sized for where they go. Use while building or editing a site or app whenever a page needs a picture, or when the user asks for images for their site/app ("add a hero image", "we need photos for the cards", "make the OG image"). Runs a Haiku helper so images never enter the main conversation. Free by default (Cloudflare Workers AI); can also use the user's own ChatGPT Plus or Google AI Pro. Not for logos as vector files, charts, diagrams or video.
---

# site-images

You are building a site or app. When a page needs images, you write a short order
(a **brief**) for each one and hand the briefs to a Haiku helper. The helper makes
each image, checks it, saves it in the project and replies with one line. You put
the path in the code and keep building.

`<skill>` below means this skill's base directory (shown when the skill loads).
All commands are `node "<skill>/scripts/site-images.mjs" <command>`.

## Rule zero: never look at the images yourself

Don't Read, open or view any generated image file in this conversation. Each image
costs a huge number of tokens and gets re-sent on every later turn. The helper
looks at them. You use the path and alt text it returns.

## 1. Check setup (once per session)

If `<skill>/node_modules` is missing, run `npm install` inside `<skill>` first.

Then run `status`. It prints `{"configured":{"cloudflare":…,"chatgpt":…,"gemini":…}}`.

If nothing is `true`, stop and help the user set up:
- Point them to `<skill>/references/setup-guide.md`. Summarise it in a few steps if they'd like.
- Give them this **one line to run in their own terminal**, with the real folder filled in:
  `node "<skill>/scripts/site-images.mjs" setup`
- **Never ask them to paste the token into the chat.** Setup asks for it with hidden typing.
- On Windows, give the line with the real full path in quotes (in PowerShell,
  `node "$env:USERPROFILE\.claude\skills\site-images\scripts\site-images.mjs" setup`
  works when the skill is installed for the user); `~` doesn't work there.
- When they say it's done, run `status` again.

## 2. One style per project

The first time this project needs images, read `site-images.json` at the project
root. If it has no `style`, pick one style line from what you know about the
project (business, audience, colours), for example
`"warm natural-light photography, earthy tones, shallow depth of field"`.
Save it as `"style"` in `site-images.json`, keeping any other keys, and tell the
user in one line that they can change it. Every brief uses this exact style line.

`projectRoot` is the folder the site is served from (in a monorepo, the app's own
folder, e.g. `apps/web`). Images go in the folder that framework serves
(`public/images`, `static/images`, …). After the first image, that folder is saved
as `"imageDir"` in `site-images.json`; change it there if it's wrong.

## 3. Write the briefs

List every image the page needs, then write one JSON file per image in
`<project>/.site-images/briefs/<name>.json`:

```json
{
  "projectRoot": "<absolute path of the project>",
  "slot": "hero",
  "filename": "hero-coffee-shop",
  "purpose": "home page hero behind the headline 'Fresh coffee, slow mornings'",
  "subject": "a barista pouring latte art into a ceramic cup",
  "place": "a small sunny cafe counter with plants",
  "style": "<the project's style line>",
  "light": "soft morning window light, warm tones",
  "framing": "medium close-up, 35mm, shallow depth of field",
  "avoid": ["people's faces"]
}
```

- `slot` picks the shape and size: `hero` and `background` (16:9, 1920 wide),
  `card` (4:3, 800), `avatar` (1:1, 512), `square` (1:1, 1080),
  `mobile-banner` (9:16, 1080), `og` (1.91:1, 1200).
- `filename`: short, descriptive, about what the image shows. It becomes kebab-case `.webp`.
- Answer **purpose, style and format from the project**. Ask the user only when the
  project truly doesn't say (for example, you don't know yet what the business is).
- **Words go in HTML/CSS, not in the image.** Headlines, buttons, prices and labels
  are page text over or beside the image. Add `"inImageText"` (max 5 words) only
  when the words are part of the scene itself, like a shop sign in the photo.
- Optional: `"provider": "chatgpt"` or `"gemini"`, only if the user asked for that one.

## 4. Send the briefs to the Haiku helper

Use the Agent tool with `model: "haiku"`. The prompt is the full text of
`<skill>/references/worker.md`, then the lines:

```
Skill folder: <skill>
Briefs:
<absolute path of brief 1>
<absolute path of brief 2>
```

Several images for one page: send them in **one message with parallel Agent
calls** (one helper per 1–3 briefs), so they're made at the same time.

## 5. Use the replies

Each image comes back as one line:

- `OK <path> | <alt text> | <provider>` → use `<path>` in the code (relative to the
  project root; adjust for how the framework serves files, e.g. `public/images/x.webp`
  is served as `/images/x.webp`) and `<alt text>` as the `alt` attribute.
- A line ending `(fell back from chatgpt: …)` → tell the user in one line that
  their browser session needs attention, e.g. "ChatGPT needs a fresh login: run `login chatgpt`".
- `FAILED <filename> | asked: … | 1st: … | 2nd: … | attempts: <path1>, <path2>` →
  the image came out wrong twice. Tell the user plainly: what was asked, what went
  wrong both times, and where the two attempts are saved. Ask them whether to
  **change the idea** (you rewrite the brief and send it again) or **make it
  manually**. Leave a clear placeholder in the code meanwhile. Don't retry on your own.
- `FAILED … | no provider worked: <reason>` → pass the reason on. If it says the
  daily free images are used up, say it resets at 00:00 UTC, or they can run setup
  to add ChatGPT or Gemini.

## Commands (reference)

| Command | Who runs it | What it does |
|---|---|---|
| `status` | you | which image makers are set up |
| `setup` | the user, in their own terminal | saves Cloudflare values, optional ChatGPT/Gemini login, runs a test |
| `login chatgpt` / `login gemini` | the user | opens a browser window to log in again |
| `test` | either | one small test image per image maker |
| `generate`, `finalize` | the Haiku helper | make one attempt; place the approved image |

The user's keys and logins live only in `~/.site-images/` on their computer. Never
copy them into the project or into this skill folder.
