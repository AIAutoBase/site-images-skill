// ChatGPT (Plus subscription) through the student's own browser session.
// If generation breaks, ChatGPT changed its page: update SITE.selectors.
import { generateInBrowser } from "./browser.mjs";

export const name = "chatgpt";
export const SITE = {
  name,
  label: "ChatGPT",
  url: "https://chatgpt.com/",
  promptPrefix: (aspect) => `Create one image, aspect ratio ${aspect}. Do not ask questions, just make it: `,
  selectors: {
    composer: "#prompt-textarea, div[contenteditable='true']",
    loginSignal: "[data-testid='login-button'], a[href*='auth/login']",
    loggedIn: "button[aria-label='Open profile menu'], button[aria-label*='perfil'], [data-testid='accounts-profile-button']",
    resultImage: "main img[src*='oaiusercontent'], main img[alt*='Generated']",
    stillGenerating: "[data-testid='stop-button'], button[aria-label*='Stop']",
  },
};

export const generate = (job) => generateInBrowser(SITE, job);
