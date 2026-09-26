---
name: track-run
description: Run one of the user's real music tracks through Afterglow offline and report what the beat grid and Journey did (lock, tempo, sections, worlds, recipes, scenes), with stills. Use for tuning against real music, when the user describes how a set felt, or to check a timing or Journey change on something other than the synthetic groove.
---

# Run a real track

The page analyses audio live, so a real track can't be sped up in real time. Instead, `tools/track-run.mjs` works offline:
1. It renders the track through an `OfflineAudioContext` with the page's analyser settings, reading it 60 times a second.
2. It feeds those frames to the page through `window.__synth`, stepping the page's test clock one frame at a time.
3. It records the grid and Journey (`__jdbg()`) once a second, and takes a still every 30 s.

```
node tools/track-run.mjs <track file> [--mode 2d|gl] [--seed 1] [--out dir]
```

- **The track never goes in the repo.** Keep it in the scratchpad, and write `--out` there too.
- Simple mode (`2d`, the default) runs a 4–5 minute track in about 10 minutes, and WebGL takes much longer. Run it in the background.
- The summary prints:
  - how many seconds the grid was locked, and the median tempo, against an independent autocorrelation estimate;
  - how many sections there were;
  - seconds spent in each world, recipe, lead, scene, hit, centrepiece and pace.

  The JSON has the per-second detail: `bpm`, `locked`, `sec`, `T` (tension), `eM`/`hi`/`lo` (energy), the fingerprint `feats`, and `kicks`/`stabs` counts.
- Compare against a reference run on `main` (same track and seed) to see what a change did. On the user's minimal techno track (272 s), after the kick fix: locked 207 s, median 129.9 BPM.

Reading it against the user's feedback:
- "Busy" or "mush": count the layers and hits per section, and check that hits land in 15–40% of sections.
- "Repetitive": look for sections that change, and for progression steps (`prog`).
- "Too fast" or "too calm": check `pace` against `T`.
- "Flat" or "nothing happens": check that the energy doesn't sink on a steady track (`T` near 0 while the music is full on), and look for false short sections.
