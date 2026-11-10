# Cloudflare setup (free, about 10 minutes)

Cloudflare's Workers AI makes the images. The free plan gives a daily allowance:
about 30 full-size hero images a day, more for smaller images. It resets every day
at 00:00 UTC. No credit card needed.

You need two values: your **Account ID** and an **API token**.

## 1. Create a free account

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with your email and confirm it.
3. You don't need to add a website or a domain. Skip any step that asks for one.

## 2. Copy your Account ID

1. Open https://dash.cloudflare.com
2. Click your account name.
3. Open **Workers & Pages** (or **Workers AI**) in the left menu.
4. Your **Account ID** is shown on the right side of the page. Click **copy**.

## 3. Create an API token

1. Open https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**.
3. Next to the **Workers AI** template, click **Use template**.
4. Click **Continue to summary**, then **Create Token**.
5. Click **copy**. Cloudflare only shows it once. If you lose it, delete the token and make a new one.

The token can only run Workers AI. It can't touch anything else in your account.

## 4. Save both values

Run this in **your own terminal**, not in the Claude chat:

```
node "<skill folder>/scripts/site-images.mjs" setup
```

Claude shows you the exact line with the right folder filled in.

- Paste the Account ID when asked.
- Paste the token when asked. Nothing shows while you type or paste. That's on purpose.
- Then answer whether you have ChatGPT Plus or Google AI Pro. Both are optional.

Your values are saved only on your computer, in a `.site-images` folder in your user
folder. Never paste the token into the Claude chat.

## Something went wrong?

- **"Cloudflare token rejected" right after creating the token**: a new token can take a minute to start working. Wait a minute, then run `test`.
- **"Cloudflare token rejected" later on**: make a new token (step 3) and run setup again.
- **"daily free images used up"**: wait until 00:00 UTC, or set up ChatGPT or Gemini as a backup.
