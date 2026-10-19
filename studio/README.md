# Studio

A separate project from the visualiser: making music together. Claude writes each track as a score in code, renders it
offline, measures it, and publishes it to a listening page; the user listens and leaves notes pinned to moments; Claude
reads them and makes the next version.

- **Scores** (`tracks/*.js`): `meta` (title, tempo, length in bars, swing, seed, version), `SECTIONS` (named bar ranges),
  and `score(d)`, which places every note on a desk. Only the scores go in git; a version is the score at a commit.
- **The desk** (`lib/desk.js`): the visualiser's own audio engine (`src/audio/engine`: the drum kit, the polysynth, the
  echo, reverb, chorus and width) on an `OfflineAudioContext`, with buses (filter, chorus, width, pan, sidechain pump, level,
  two sends), returns, automation in bars (`d.ramp`, `d.dbRamp`), noise swells, and a master (glue compression, a limiter).
  Notes go in by bar and 16th: `d.hit`, `d.pattern('x...X...o...')`, `d.note`, `d.chord`. Kicks on the kit marked `side`
  duck every bus with `pump`.
- **Rendering** (`render.mjs`): `node studio/render.mjs 01-slow-bloom` renders in headless Chromium and writes to
  `studio/out/<track>/` (ignored by git): the WAV, an MP3 and a WebM (Opus: what the listening page's assets take), a spectrogram, and a report per section (level, width, low end,
  brightness, pumping in dB, integrated loudness), and each part's level and width per section from meters on every bus
  (read at the render's pauses: notes are made a few seconds before they play, since Chromium processes every waiting
  node each block). `--variant b` renders a score's variation (`meta.variants`, read as `d.variant`). `--from 48 --to 64` keeps only those bars (it renders up to `--to`). `spectrogram.py` draws the picture.
- **Listening** (`listen/index.html`, the Studio Listening Room artifact): every version with its spectrogram, sections and
  measurements; a note box that pins to the moment you start typing; 👍 / 👎 per moment and per section. Tracks are rows in
  the artifact's `tracks` collection (the WebM and spectrogram uploaded as its assets: https://claude.ai/artifact/CXwNnssbyf5oxFNzc1r3yK); notes go to `notes`, which Claude
  reads before the next version.
- **Loop labs** (`labs/*.js`, `lab.mjs`, `listen/lab.html`, the Studio Loop Lab artifact: https://claude.ai/artifact/B7EoLYmW46wB7JxLJBxYYW):
  for throwing many ideas for one part at the wall. A lab is a backing loop (16 bars of a groove, the part left out) and
  ideas for the part, each rendered as its own stem in time with it (`node studio/lab.mjs bass`: a raw desk with no master
  chain, `d.solo` for the stems, what rings past the loop folded back onto its start, each idea matched in loudness, one
  shared gain; AAC in MP4, in `studio/out/labs/<lab>/`). The page plays the loop and swaps the part under it in time;
  👍 / 👎 and a note per idea go to its `flags` collection (`<lab>__<idea>`), the labs themselves to `labs`.
