---
name: check-visual
description: See one Afterglow visual (a world, layer, hit or object) on its own in both renderers, with stills to look at and compare. Use after changing how something looks, when the user reports a visual problem, or before and after a tuning change.
---

# Check a visual

`tools/look.mjs` solos a visual, as the panel's Solo button does. That turns Journey off, sets every other visual to 0, and removes the lens and movers. It then steps the page on its test clock with the built-in groove and saves a still from WebGL and from simple mode.

```
node tools/look.mjs <key> [--mode both|gl|2d] [--frames 300] [--size 960x540] [--out dir] [--eval "js"]
```

- `<key>` is the registry key: `cosmos`, `city`, `land`, `space`, `aurora`, `ring`, `comets`, `flow`, `skull`, `knot` and so on. An unknown key lists them all.
- Write stills to the scratchpad (`--out <scratchpad>/look`), never into the repo. Open the PNGs with the Read tool and actually look at them.
- `--eval` runs page code after the solo and before stepping. Use it to set up a moment, for example the cosmos's camera:
  `--eval "const {byKey} = await import('/src/visuals/registry.js'); byKey.cosmos.visit('hole'); byKey.cosmos.hold(60)"`
  (the cosmos also has `shot('belt'|'skim'|'orbit'|…)`, `jump()`, `galaxy()`). A world only has its state once it has drawn, so step a little first (`__step(30); byKey.cosmos.shot('approach')`), or the call does nothing.
- Software WebGL is slow, about 6 fps at 960×540. 300 frames takes a minute or two, so run long ones in the background.
- The output prints the panel's "On screen" line (what was drawn) and any page errors. Both must be clean.

Checking a change:
1. Take stills before the change (`git stash`, or run from `main`) and after, with the same key, frames and `--eval`, then compare them.
2. Check both renderers. Every visual has a WebGL version and a simpler Canvas 2D one, and both must show the change.
3. Show the user the stills that matter (`SendUserFile`), and say what changed in plain words.

For a whole scene rather than one visual, use a preset: `--eval "const {presets} = await import('/src/presets.js'); const {setPreset} = await import('/src/ui/presets.js'); setPreset(presets.find(p => p.name === 'Skull in the city'))"`.

## Motion and feel: `tools/strip.mjs`

A still can't show movement. For how something moves, or how a stretch *feels*, make a strip:

```
node tools/strip.mjs [--preset NAME | --solo KEY] [--query "?lab=cosmos"] [--eval "js"] [--mode 2d|gl] [--secs 8] [--frames 8] [--out dir] [--name x]
```

- It writes one picture of `--frames` frames across `--secs` seconds (read left to right, top to bottom), plus a JSON of measures, and prints them:
  - **brightness:** the average, 0 black to 1 white;
  - **lit:** how much of the screen is lit;
  - **detail:** how busy the picture is (edges);
  - **motion:** how much the picture changes a second;
  - **flashes:** jumps in brightness a second (the kick's flash, hits);
  - **on screen:** the panel's own words, and how many things that is.
- With no `--preset` or `--solo`, Journey runs on the built-in beat. `--warm` (default 4 s) lets it settle first.
- Use the numbers for the user's words: "busy" (detail, lit, things on screen), "fast" (motion), "flashy" (flashes), "dark" or "washed out" (brightness). Compare before and after a change, with the same arguments and seed.
