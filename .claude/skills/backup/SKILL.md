---
name: backup
description: Back up the Studio's and the visualiser's artifact databases into the repo (data/), or restore them into a new artifact, e.g. on another claude.ai account. Use when the user says "back up", "save my data", "restore", or is moving to another account; and before committing Studio work that changed what's saved.
---

# Backing up and restoring the artifacts' databases

Each artifact's database is its own: a new artifact (another account's, or a fresh publish) starts empty. `data/` in the
repo holds a copy (see `data/README.md`). Settings kept only in a browser's `localStorage` aren't in it.

## Back up (on the account that owns the artifacts)

1. For each collection, `ArtifactData` `list` with `query.limit` 1000 (page with `cursor` if `next_cursor` comes back) and
   `out_dir` the folder below, so each document lands at `<out_dir>/<collection>/<doc id>.json`:
   - the Studio, https://claude.ai/artifact/Sh5taBdvs5HZZej4d4qKV2 → `out_dir` `data/studio`: `feedback`, `snaps`,
     `likes`, `songs`, `ideas`, `versions`, `sounds`, `projects`, `takes`, `notes`, `jams`, `arrangements`, `library`,
     and `settings` once the page keeps one;
   - the visualiser, https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ → `out_dir` `data/afterglow`: `moments`, `comments`, `settings` (its browser settings).
   Clear each collection's folder first, so documents deleted in the artifact don't linger.
2. Rename every file with `:` in its name to `%3A` (`for f in $(find data -name '*:*'); do mv "$f" "${f//:/%3A}"; done`).
3. Rewrite `data/MANIFEST.json` (the time, the two URLs, a count per collection).
4. The repo is public: the user agreed (2026-11-01) their musical ratings, notes and settings may be public. Check
   the copy holds no emails, `u_…` account ids or anything else personal before committing; if it does, ask.
5. If nothing in `data/` changed but `MANIFEST.json`'s time, discard it and stop. Otherwise commit `data/` ("Back up
   the artifacts' databases") and push to main.

## Restore (into a new artifact)

1. Publish the page from the repo (the `publish` skill for the visualiser; `node studio/studio/build.mjs` and the
   Studio's `studio/listen/studio.html` with the same `db` capability rules as the old one: one rule a collection,
   `read: view, write: interact`, `ideas` `write: admin`, plus `settings`, and `downloads: true` for Export). Note the new URL in CLAUDE.md.
2. For each `data/<artifact>/<collection>/<file>.json`: its document id is the file name without `.json`, `%3A` back
   to `:`. `ArtifactData` `batch` `set` them into the new artifact, up to 50 a batch and under 1 MiB a batch (send
   the big ones, `ideas`, `songs`, `versions`, a few at a time, with `file_path`).
3. `list` each collection in the new artifact and check the counts against `data/MANIFEST.json`.
4. Put the new URLs in CLAUDE.md (and in this skill), and set up the daily backup routine on this account
   (`create_trigger`, a fresh session each day, the prompt: "Run the backup skill in Raganther/visualiser-: export the
   artifacts' databases into data/, and commit and push to main only if something changed."). Commit and push.
5. Tell the user to open both pages: their browser settings come back from `settings/local` by themselves.

Without Claude: the Studio's **Export** button saves one file of everything (the database and the browser's settings,
song versions too) and **Import** on the other account's Studio loads it.
