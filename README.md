# site-images

A Claude Code skill that gets images into the website or app you're building,
without leaving Claude.

When a page needs a hero, service cards, a background or a social preview image,
Claude writes a short order for each one and hands it to a Haiku helper. The helper:

- makes the image
- looks at it, and makes it again once if it came out wrong
- saves it in your project's image folder, named for what it shows and sized for where it goes

Claude puts it in the code and keeps building. If an image comes out wrong twice,
Claude tells you and lets you decide what to do.

Shared with the AI Auto Base community. MIT licensed. Read [DISCLAIMER.md](DISCLAIMER.md) before use.

## What you need

- [Claude Code](https://claude.com/claude-code)
- [Node.js](https://nodejs.org) 18 or newer
- One image maker:

| Image maker | Cost | How it connects | Good to know |
|---|---|---|---|
| **Cloudflare Workers AI** (default) | Free daily allowance: about 30 full-size hero images a day, more for smaller ones | Account ID + API token | Stable and fast. Model: FLUX.2 [klein] 4B (Apache 2.0, commercial use OK). |
| **ChatGPT** | Your ChatGPT Plus subscription | Your own browser session, logged in once | Better with words inside the picture. |
| **Gemini** | Your Google AI Pro subscription | Your own browser session, logged in once | Same as ChatGPT. |

ChatGPT and Gemini work by driving your own logged-in browser. They can break
when those sites change their layout, and automating them is a grey area under
their terms of use. Cloudflare is the safe path; treat the other two as extras.

## Install

1. Copy the `skill` folder to `~/.claude/skills/site-images`.
   - Windows: `%USERPROFILE%\.claude\skills\site-images`
2. In that folder, run `npm install`.
3. In your own terminal (not in the Claude chat), run:

   - macOS / Linux:

     ```
     node ~/.claude/skills/site-images/scripts/site-images.mjs setup
     ```

   - Windows (PowerShell):

     ```
     node "$env:USERPROFILE\.claude\skills\site-images\scripts\site-images.mjs" setup
     ```

   Or ask Claude "set up site-images" and it prints the exact line for your computer.

   Setup asks for your Cloudflare Account ID and API token, with hidden typing for
   the token. Then it asks whether you have ChatGPT Plus or Google AI Pro, and makes
   one test image with each. Getting the Cloudflare values takes about 10 minutes;
   see [skill/references/setup-guide.md](skill/references/setup-guide.md).

Your keys and logins are saved only on your computer, in `~/.site-images/`. They
never go into the skill folder or your project.

## Use

Build a site with Claude Code as usual. When a page needs images, the skill kicks
in. You can also ask for one directly: "add a hero image of a cozy bakery".

What lands in your project:

- `public/images/hero-bakery.webp` (or your project's image folder)
- `site-images.json`: the project's image style, plus a log of what was made
- `.site-images/`: drafts and orders; it's added to `.gitignore`

All images in one project share one style line, saved in `site-images.json`.
Edit it to change the look.

## Troubleshooting

| Message | Fix |
|---|---|
| "Cloudflare is not set up" | Run `setup` |
| "Cloudflare token rejected" | Make a new token (setup guide, step 3) and run `setup` again |
| "daily free images used up" | Wait until 00:00 UTC, or add ChatGPT or Gemini with `setup` |
| "ChatGPT is logged out" / "Gemini is logged out" | Run `login chatgpt` or `login gemini` |
| "page did not look as expected" | The site changed. Update the `selectors` at the top of `scripts/providers/chatgpt.mjs` or `gemini.mjs`, or use Cloudflare |

To check everything works, run the same command as setup with `test` instead of `setup`.

## Develop

```
npm install            # repo root: test tools
cd skill && npm install
cd .. && npm test
node scripts/grep-gate.mjs skill/   # nothing personal or secret in the shipped folder
```
