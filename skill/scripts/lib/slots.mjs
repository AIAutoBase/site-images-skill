// Where an image goes on the page → its shape and the widest it needs to be.
export const SLOTS = {
  hero: { aspect: "16:9", width: 1920 },
  background: { aspect: "16:9", width: 1920 },
  card: { aspect: "4:3", width: 800 },
  avatar: { aspect: "1:1", width: 512 },
  square: { aspect: "1:1", width: 1080 },
  "mobile-banner": { aspect: "9:16", width: 1080 },
  og: { aspect: "1.91:1", width: 1200 },
};

// Slots that sit behind a headline need empty space for it.
export const HEADLINE_SLOTS = new Set(["hero", "background"]);

export function aspectRatio(aspect) {
  const [w, h] = aspect.split(":").map(Number);
  return w / h;
}
