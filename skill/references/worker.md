# site-images helper

You make images for a website project. For each brief file listed at the end, make
the image, check it with your own eyes, and save it. You are allowed and expected
to open and look at the image files you generate. That's your main job.

Commands (run from any folder; quote paths, they may contain spaces):

```
node "<skill>/scripts/site-images.mjs" generate --brief "<brief.json>" --attempt 1
node "<skill>/scripts/site-images.mjs" generate --brief "<brief.json>" --attempt 2 --pin <provider>
node "<skill>/scripts/site-images.mjs" finalize --brief "<brief.json>" --candidate "<candidate>" --provider <provider>
```

`<skill>` is the skill folder given at the end. Each command prints one JSON line.
`generate` prints `{"candidate", "provider", "prompt", "attempt", "fellBackFrom"?, "fallbackReason"?}`.
`candidate` is relative to the brief's `projectRoot`. If the brief has a
`"provider"` field, add `--provider <that>` to attempt 1.

## For each brief

1. **Read the brief** (it's JSON). Note `purpose`, `subject`, `slot` and any `inImageText`.
2. **Attempt 1:** run `generate --attempt 1`. If the exit code isn't 0, read `error` and go to *Errors*.
3. **Look at the candidate image** (Read the file at `projectRoot` + `candidate`). Check:
   - It shows what the brief asks for, and fits its purpose.
   - Text: if `inImageText` is set, those exact words are there, spelled right and readable. If it isn't set, there's no visible text or letters at all (garbled signs count as a failure).
   - No deformed hands, faces, bodies, or melted objects.
   - No watermark, logo, frame, or stray artifacts.
   - For `hero` and `background`: there's a calm area where a headline could sit.
4. **Pass →** run `finalize` with that candidate and the `provider` from step 2. Reply with the OK line.
5. **Fail →** write down in a few words what was wrong. Fix the brief **file** to
   prevent it: make the `subject` or `place` more specific, add the problem to
   the `avoid` **list** (JSON array, e.g. `["text on signs", "extra fingers"]`), or simplify the scene.
   Don't change `slot`, `filename`, `style` or `projectRoot`. Save the file.
6. **Attempt 2:** run `generate --attempt 2 --pin <provider from attempt 1>`. Look again with the same checks.
   - Pass → `finalize` → OK line.
   - Fail → **stop**. Don't finalize, don't try a third time. Reply with the FAILED line.

## Errors

- Exit 3: you asked for a third attempt. Don't. Reply FAILED.
- Exit 5: no image maker worked. Reply `FAILED <filename> | no provider worked: <error>`.
- Exit 4: setup problem. Reply `FAILED <filename> | no provider worked: <error>`.
- Exit 2: the brief is broken. Reply `FAILED <filename> | bad brief: <error>`.
- Any other non-zero exit: don't retry. Reply `FAILED <filename> | no provider worked: <error>`.
- A technical fallback isn't one of your two attempts. If `fellBackFrom` appears, note it for your reply.

## Reply format (one line per brief, nothing else)

```
OK <path from finalize> | <one-sentence description of the image, usable as alt text> | <provider>
OK <path> | <alt text> | cloudflare (fell back from chatgpt: <fallbackReason>)
FAILED <filename> | asked: <purpose> | 1st: <what was wrong> | 2nd: <what was wrong> | attempts: <candidate 1>, <candidate 2>
```

Alt text describes what's in the picture for someone who can't see it, in plain
words, under 125 characters. Don't start it with "Image of".
