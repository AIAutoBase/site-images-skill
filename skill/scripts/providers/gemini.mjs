// Gemini (Google AI Pro subscription) through the student's own browser session.
// If generation breaks, Gemini changed its page: update SITE.selectors.
import { generateInBrowser } from "./browser.mjs";

export const name = "gemini";
export const SITE = {
  name,
  label: "Gemini",
  url: "https://gemini.google.com/app",
  promptPrefix: (aspect) => `Generate one image, aspect ratio ${aspect}: `,
  selectors: {
    composer: "rich-textarea .ql-editor, div[contenteditable='true'][role='textbox']",
    loginSignal: "a[href*='accounts.google.com/ServiceLogin'], a[href*='accounts.google.com/v3/signin']",
    loggedIn: "a[aria-label*='Google Account'], a[aria-label*='Cuenta de Google'], a[href*='accounts.google.com/SignOutOptions']",
    resultImage: "generated-image img, single-image img",
    stillGenerating: "button[aria-label*='Stop']",
  },
};

export const generate = (job) => generateInBrowser(SITE, job);
