# Full audit, 2026-09-25

A second audit of the whole system, after the composition rebuild, the engine finish and the new city. Two read-only code
audits (correctness; architecture and performance) plus a visual pass over every world and layer. Findings are grouped into
waves, worked through in order; each wave lands with the tests green. `[x]` done, `[-]` decided against (with why).

## Wave 1: the test suite (so everything after it is quicker to check)
The full `npm test` took 25–30 min, most of it WebGL frames in `scene.mjs` and golden, and simple-mode frames that nobody looks at.
- [x] `scene.mjs`: one run per (settings, scene), several snapshots per run, cached; duplicate runs removed.
- [x] A `__noDraw` hook, so tests that only read Journey or the grid (grid, journey, the objects lab) don't draw.
- [x] `tests/run.mjs` runs files two at a time and prints each file's time.

## Wave 2: correctness and robustness
- [x] Kick floor lock-out: after a loud track, a quieter one could never pass the kick floor (`kickFl` never resets or decays). Reset on a new track, and let the floor relax after silence.
- [x] WebGL context loss: not handled at all; a phone backgrounding the tab could leave it black for good. Handle loss and restore (rebuild programs, targets, meshes, the tunnel's texture).
- [x] Hidden tab: the beat grid caught up every missed beat in one frame (hundreds of section changes and shatters). Skip ahead instead.
- [x] Trail groups over budget could leave no `main` group, crashing simple mode every frame; every extra group shared one texture unit; a third masked object broke the shader; an off-screen mask's blank was shared between inside and outside. Main always allowed, a unit per group, masks capped at two, a per-mask "on" uniform.
- [x] With no trails in a scene, the audio data and shared uniforms went stale and a mesh could sample the surface it draws into. Upload once per frame, unbind after the finish, give meshes a blank fill texture.
- [x] Groups a scene no longer uses kept their old frames (and memory): cleared when dropped.
- [x] The tunnel re-uploaded video for every group and fill: once per frame.
- [x] Frame rate: feel numbers are per frame, so 120 Hz screens halved trails and flashes. Cap drawing at 60 fps.
- [x] Objects popped out (and in late) when a centrepiece changed within a template: templates keep `{objects: true}`.
- [x] Resize: debounced, and skipped when the size didn't change (phones fire it when the address bar moves, wiping the trails).
- [x] The landscape's mountains used the old energy formula that collapses on steady tracks.
- [x] A suspended audio context (iOS interruptions) is resumed.
- [x] Scene editor: keeps focus across edits, lets the same template be picked twice, dedupes worlds and hits, names extra groups uniquely.

## Wave 3: performance
- [ ] The feedback shader ran every layer on every pixel whatever its weight: each layer (and the shockwaves) skipped when off.
- [ ] Depth buffers only where an object is drawn; none on the canvas.
- [ ] Segment shaders for every template compiled when the page is idle, so a scene change doesn't hitch on the downbeat.
- [ ] Per-frame allocations trimmed (a reused per-group settings object, hoisted lists).

## Wave 4: structure
- [ ] `gl.js` ↔ `canvas2d.js` and `cast.js` ↔ `recipes.js` import cycles removed.
- [ ] The city's numbers written once (interpolated into its shader).
- [ ] Dead exports removed; the build checks its replacements and escapes `<!--` and `</style`.
- [ ] CLAUDE.md corrected (25 presets; trails clamp at 1, surfaces don't).
- [-] UI hooks to break engine → UI imports: a wide refactor of load order for no visible gain; the cycles are all function-level and safe. Noted in CLAUDE.md.

## Wave 5: creative
- [ ] Landscape: ridges with depth tint and valley mist.
- [ ] Space: banded rings the planet shadows, a stronger nebula.
- [ ] Aurora: rays in the curtains, a lake reflecting them under the treeline.
- [ ] Flow: bigger particles drawn as short streaks along their motion.

## Log
- Waves 1–2: the suite runs two files at a time with each file's time, `scene.mjs` caches deterministic runs and takes several snapshots per run, and tests that only read Journey don't draw: `npm test` about 9½ min (from 25–30). All the correctness fixes above landed, with regression checks: a quieter stretch after a loud one (`grid.mjs`; .03 kicks a beat before, .35 after, at 22 dB down) and the scenes that used to break (`scene.mjs`). Golden re-recorded: the kick floor now forgets after 1.5 s without a kick (the groove's breakdown), and the landscape reads the fixed energy.
