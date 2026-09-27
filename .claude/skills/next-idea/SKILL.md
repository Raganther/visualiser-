---
name: next-idea
description: Build the top idea from docs/ideas.md on its own branch, test it, check it by eye, publish a preview, and open a pull request for the user. Use when a scheduled run fires, or when the user says "build the next idea".
---

# Build the next idea

The user curates `docs/ideas.md`. One run builds one idea and hands it to the user. It never merges and never publishes over the user's own page.

1. **Read first:**
   - `CLAUDE.md`;
   - `docs/taste.md` (the principles, and especially "few things at once");
   - `docs/ideas.md`.

   Take the **first item under "Up next"** that no open pull request already claims. If there's none, stop and say so.
2. **Branch:** `idea/<short-name>` from `main`.
3. **Build it** the way the codebase does things:
   - one module per visual, registered;
   - both renderers;
   - feel numbers in `TUNE`;
   - Journey's rules kept: a new thing replaces, it doesn't pile on.

   If the idea is too big for one run, build a first stage that stands on its own, and write the rest back into `docs/ideas.md` as the next item.
4. **Test:**
   - `npm test` must pass;
   - add a check for the new thing to the nearest test file;
   - re-record golden only if Journey's behaviour changed on purpose, and say why in the commit.
5. **Look at it:**
   - `check-visual` (`tools/look.mjs`) for stills in both renderers;
   - `tools/strip.mjs` for how it moves;
   - the `track-run` skill on a real track if there is one in the scratchpad.

   Judge it against `docs/taste.md`. Fix what looks cheap, busy or generic before handing it over.
6. **Preview:** publish `dist/afterglow.html` (after `npm run test:dist`) as a **new** Artifact titled "Afterglow preview: <idea>", not to the user's own page.
7. **Pull request** into `main`. The body says:
   - what was built, and how to see it (the lab key, preset or Solo);
   - the preview's link;
   - the stills, described;
   - what's left.

   Move the item in `docs/ideas.md` to "Done" in the same branch.
8. **Stop.** Don't merge. The user reviews, and merges what they like.
