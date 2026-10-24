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
  👍, Maybe, 👎 and a note per idea go to its `flags` collection (`<lab>__<idea>`: rating 1 like, 2 maybe, -1 dislike), the
  labs themselves to `labs`. `labs/kit.js` is the shared groove: Slow Bloom's loop split into parts (drums, bass, pad, lead),
  their defaults (what plays behind another part's lab) and `labScore(part, ideas)`. The labs: `bass` (the first sixteen),
  `bass2` (the liked motifs crossed with the liked sounds), `pads`, `leads`, `drums`, `kicks` (around the liked kick, `GOOD_KICK`), `drums2` (the liked grooves on it, and polyrhythms in metal and bells), `bells` (bells, metal and wood on the liked motifs).
- **The jam** (`labs/jam.js`, `jam.mjs`, `listen/jam.html`, the Studio Jam artifact: https://claude.ai/artifact/4ksCPJwLWaDNysk9qHuGJM):
  the liked (and maybe) ideas from every lab as clips in rows (kick, drums, bass, pad, lead, bells), each rendered alone
  in time with the same 16-bar loop (`node studio/jam.mjs`: 57 stems, a level per row, one shared gain), so the page plays
  one clip per row together and swaps any of them on the loop. The kick is rendered in each drum pattern (four to the
  floor, or the broken beat's) and follows the drums clip picked. A level and mute per row, Shuffle (likes only), and
  **Keep this combination** with a note, to the `combos` collection; the jam itself is a row in `jams`.
- **The native engine** (`lib/native/`): sounds computed from their physics instead of the visualiser's instrument models.
  `modal.js` rings struck objects as their real modes (kalimba tine, marimba and vibraphone bars, music box, church and
  tubular bells, steel pan, woodblock, glass, metal plate, gong: each mode its own ratio, level and decay, the mallet's
  hardness and strike point weighting them, doublets beating); `body.js` has a struck membrane (kick, toms, hand drums),
  a plucked string (Karplus and Strong), a shaker (beads colliding), grain clouds and rain. `index.js` names them and
  caches each note; `d.native(bus, name, set)` on the desk plays them like a synth (`d.note`, `d.morph` on their settings).
  `labs/native.js` puts each liked sound now and native side by side (the `native-1` lab). Every instrument is also a
  streaming voice (`stream.js`: run as it plays, let go, done), which is what each note computed ahead runs, and what the
  DAW's live engine (`arrange/voices.worklet.js`) plays sample by sample; `npoly.js` is the poly synth and `kit.js` the
  drum machine rebuilt the same way; `analogkit.js` is a drum machine of our own, built as analog circuits behave (five
  kits, in pack 4).
- **Playgrounds** (one instrument each, apart from the DAW): the drum lab (`drums/`, `listen/drum-lab.html`:
  https://claude.ai/artifact/YKgxU7HuHwXHadYed9aAqQ) plays `analogkit.js` on twelve beats; the synth lab (`synth/`,
  `listen/synth-lab.html`: https://claude.ai/artifact/9iHiMbMP1a5zcV2kb5WVGL) plays `asynth.js`, an analog synth of our own (two
  band-limited oscillators with sync and cross-mod, a sub, noise and ring mod, a saturating ladder or a state-variable
  filter, capacitor envelopes, eight voice cards that drift, an LFO, poly, mono, legato and unison, chorus and tape echo),
  on fourteen examples, each a patch and a phrase written for it; the drum rack lab (`rack/`, `listen/rack-lab.html`:
  https://claude.ai/artifact/W8DtRouN8ueMwYNpfZDVqZ) takes the analog kit apart into a channel a pad, a bus of processors to switch,
  move, take out and add to (in and out at matched loudness), and echo and room returns; the ducking lab (`duck/`,
  `listen/duck-lab.html`: https://claude.ai/artifact/4kNr9C6sBzkNDBupg7GvsS) sets a sidechain compressor against a ducker
  that reads the score and moves before each hit, kick → bass, lead → pad and kick → pad, with what each does drawn
  (the user found it no better: mixes use the classic sidechain compressor); the mix lab (`mix/`, `listen/mix-lab.html`:
  https://claude.ai/artifact/53SbVEpeak5GaQW4zi51Nd) mixes round 4's three songs the traditional way on the parts, every sound and processor native (`mix/mix.js`: the song
  as the host's description and timed messages; `mix/song.mjs` reads it for the build and tests; `mix/calibrate.mjs` measures each song's gain staging into `levels.js`).
  `node studio/<drums|synth|rack|duck|mix>/build.mjs` builds each; `tests/synthlab.mjs`, `racklab.mjs`, `ducklab.mjs` and `mixlab.mjs`
  measure the parts and play the pages.
- **The parts** (`lib/parts/`): what the playgrounds are built from, so they can be mixed and matched. `procs.js` the
  processors (each describes its settings; `Chain` strings them), `host.js` the host (a description of sources, strips,
  buses, sends and returns, played by timed events, in the audio thread by `host.worklet.js` or offline), `shell.js` what
  a playground's page shares (controls for any setting, a chain editor, meters, notes for Claude). A new playground is a
  page asking one question.
