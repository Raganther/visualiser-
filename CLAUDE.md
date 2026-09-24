# Afterglow visualiser

A music visualiser that runs entirely in the browser. You drop in MP3s, it analyses them live with Web Audio, and it draws a glowing feedback piece that follows the music. Its automatic director, **Journey**, decides what appears, when, and how it moves.

- The code is plain ES modules with no runtime dependencies. The only external request is the Chakra Petch font.
- **Develop:** run `npm run serve` (which runs `python3 -m http.server`) and open `index.html`. Modules don't load from `file://`.
- **Publish:** the published copy is a claude.ai Artifact: https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ.
  1. `npm run build` bundles everything into one self-contained `dist/afterglow.html`, using esbuild, the only dev dependency (`npm install`).
  2. Run `npm run test:dist` to check the bundle.
  3. Republish `dist/afterglow.html` to that URL.
- **Audience:** the user tests with real tracks, mostly minimal techno. Most feedback is about how it *feels* over a whole set: busy vs sparse, fast vs calm, repetitive vs progressing.

## Layout

```
index.html, styles.css     markup and styles; index.html also handles ?seed= and shows errors
src/main.js                boot and the render loop: builds P each frame and hands it to a renderer
src/state.js               shared buffers, and S: the few variables several modules reassign (S.beat, S.active, S.MT …)
src/tuning.js              TUNE: every feel number, one commented line each
src/lab.js, src/lab/       ?tune= and ?lab= experiment hooks (src/lab/example.js shows a lab)
src/presets.js             SPEC (settings and sliders, partly from the registry), movers, BASE presets/recipes
src/util.js                $, maths, colour (hc, hsv2rgb), noise
src/visuals/registry.js    lists every world, hit, layer and object; everything else is built from it
src/visuals/worlds|hits|layers|objects/*.js   one module per visual (see below)
src/render/                gl.js (WebGL passes), canvas2d.js (simple mode), compose.js (builds both shaders from the registry), shaders.js (fixed programs), mesh.js (3D meshes as wire and glass panes)
src/journey/               core (J, jState), sections, worlds, cast, recipes, transitions, progression, pace, director (stepJourney, __jdbg)
src/audio/                 player, analysis (levels, onsets), synth (built-in beat), beatgrid (tempo, clock, downbeat, gridBeat)
src/fx/                    particles (flow), effects (comets, shockwave motion, stabs), pulse, movers
src/media/source.js        MEDIA: the video, image or camera feeding the mirror tunnel (a leaf module)
src/ui/                    panel (sliders, narration), presets (switch/randomize), controls (keys, pad, buttons), transport, toast
tests/                     npm test: smoke, media, objects, sync, grid, journey, golden (see Testing)
tools/build.mjs            the bundler for dist/afterglow.html
tools/*-mesh.mjs           make the skull's and unicorn's meshes (npm run mesh), using tools/mesh-kit.mjs
```

## How it draws

- **Feedback engine.** Each frame redraws the last frame zoomed, spun, warped and faded (`decay`), then adds the layers on top. This is what makes the glowing trails.
  - WebGL: the feedback shader ping-pongs between two framebuffers.
  - The display shader then composites the result onto the screen.
  - Both shaders are assembled by `render/compose.js` from the registry.
- **Crisp layers.** Worlds (backgrounds) and hits are drawn in the display pass every frame, *outside* the trails, so they never smear. Anything that has to appear or vanish cleanly belongs there.
- **Simple mode.** `render/canvas2d.js` (`make2D`) is a Canvas 2D fallback for browsers without WebGL. **Every visual needs a version in both renderers.** The 2D one can be plainer.
- **Parameters.** `render()` in `main.js` builds `P` each frame. Each visual's `params()` adds its own fields. `t` is *motion time* (`S.MT`), not wall time; see Pace below.

## Visuals and the registry

| Kind | What it is | Modules | How it arrives |
|---|---|---|---|
| **Worlds** | Backgrounds, crisp (display pass) | `land`, `space`, `aurora`, `city` (plus none/black) | Fade, or cut on the bar |
| **Layers** | Continuous glowing effects in the trails (feedback pass) | `ring`, `scope`, `plasma`, `burst`, `comets`, `flow`, `ribbons`, `horizon` | Fade, or cut on the bar |
| **Hits** | One-shot shapes fired by the music | `star` and `outline` (downbeat), `sparkle` (stabs), `shock` (pulse; drawn in the trails) | Snap in, then snap or flicker out |
| **Objects** | 3D centrepieces, crisp: meshes drawn over the finished picture (or ray-marched in the display pass) | `skull`, `unicorn`, and the maths shapes `geosphere`, `torus`, `knot`, `dodeca`, `spikes` | Assembles out of flying panes; shatters and reassembles; panes wink out as it leaves |
| **Opt-in** | Drawn and given a slider, but outside Journey's usual pool (`optIn: true`) | `tunnel` (the mirror tunnel), every object | The tunnel comes in as the lead while media is loaded; an object only with `TUNE[key].chance > 0` |
| **Lens** | Transforms everything, draws nothing itself | `sym` (kaleidoscope folds), `mirror` in `SPEC` | Eases in, or flips on the bar |
| **Motion / colour** | How the feedback moves | `decay`, `zoom`, `rot`, `warp`, `wander`, `colorSpeed`, `hueDrift` in `SPEC` | Continuous |

Each visual is **one module** exporting an object. From it the engine builds the slider, the shaders, both renderers' drawing and Journey's choices. The fields:
- **Everyone:**
  - `key`, `kind`, `label`
  - `params(P, x)`: add fields to `P`. `x` carries `eff`, `react`, `sBass`, `sTreb`, `dim`, `t`, `dt`, `hit`, `J`, `comets`, `shocks`, `parts`, `NP`.
  - `onBeat(pos, beats)`
- **Worlds:**
  - `suits(rf, T)`: the Journey score.
  - `glsl: {uniforms, functions, fn}`: `fn(sp)` returns the world's colour.
  - `uniforms(gl, u, P)`, `draw2d(o, P, t)`, `init2d()`, `step(dt, x)`
  - `horizonY`: the horizon grid lines up with the world's ground.
- **Hits:**
  - `trigger`: `downbeat`, `stab` or `pulse`.
  - `level`, `words` (narration), `suits(rf, wOn, seed)`, `fire(x)` (`x` carries `J` and `ty`), `step(dt)`
  - `glsl: {uniforms, functions, draw}`, `uniforms`, `draw2d(o, P)`
- **Layers:**
  - Journey data: `suits` (features object), `overWorld`, `accent` / `altAccent`, `paint` (trail order).
  - `feedback: {uniforms, functions, glow | folded | main | displace}`:
    - `glow` adds to the shared brightness `g`, like ring, scope and plasma;
    - `folded` is its own colour inside the kaleidoscope fold, like burst;
    - `main` draws on top, in `paint` order;
    - `displace` pushes where everything is sampled, like shockwaves.
  - `fbUniforms(gl, u, P)`. The layer's weight arrives as `uL_<key>`.
  - 2D drawing: `folded2d(c, P, x)` inside the fold, or `trails2d(c, P, x)`.
  - Flow's WebGL points pass is the one piece kept in `render/gl.js`, because it needs its own program.
- **Objects:**
  - `words` (narration). The weight arrives as `P.o[key]`.
  - A mesh object, made by `meshObject()` in `objects/mesh-object.js`: `drawGL(gl, P, W, H, stage)` is called twice a frame. With `'trails'` it draws into the feedback buffer, so the object leaves ghosts; with `'screen'` it draws over the finished picture. It also has `draw2d(o, P)`. Both hand off to `render/mesh.js`.
  - A ray-marched object (none at the moment; the old skull was one): `glsl: {uniforms, functions, fn}` in the display pass, where `fn(sp)` returns premultiplied colour and coverage. Its weight also arrives as `uO_<key>`.
  - Tuning: `TUNE.mesh` sets how all mesh objects look and move, including Journey's `level`. `TUNE[key]` holds each object's `chance` (per section; 0 = never, with no random draw), `size` and `hinge` swing.

**Adding a visual:**
1. Copy the closest module in `src/visuals/…/`.
2. Change it.
3. Add one import line and list entry in `registry.js`.

Its slider, shader code, drawing, narration and Journey scoring all follow from that. The rules:
- **Imports.** Visual modules import only leaf modules (`state.js`, `util.js`); the engine passes them everything else. This keeps load order safe.
- **Recipes.** Optionally, give the visual a preset in `BASE` (presets double as Journey's recipes).
- **Checks.** Test it alone in both renderers, as in Testing below.

**Opt-in visuals** (`optIn: true`) sit outside Journey's choices, so adding one never changes how Journey behaves:
- They're left out of `ELEMS`, `SUITS` and the other Journey tables.
- Their sliders go in a "Media and objects" group at the end of `SPEC`, so earlier settings keep their positions; movers seed their drift by position.
- The golden test lists them as new settings that stay at 0, rather than failing.

Presets with `journey: false` are manual-mode looks only; Journey's recipe pool skips them.

- **Movers** (`mods` on a preset): per-setting automation such as drift, follows bass/mids/treble, pulses on beat, or jumps on beat.
  - "Follows" uses `bands` from `audio/analysis.js`: each band's level against its own recent quiet and loud (0..1). So bass pumps with the kick, mids with claps and stabs, and treble with hats and crashes. The raw levels mostly sit high and barely move, so they're no good for this.
  - A mover set by hand during Journey goes in `J.userMods`, and `recipeMods()` keeps it from section to section.
- **Presets** (`BASE`, 14 of them): hand-made looks for manual mode. Journey also reads them as **recipes**.

## Journey (the automatic director)

Journey lives in `src/journey/`. The main principle, which came from user feedback: **few things at once.** The user found four or five layers plus kaleidoscope copies "mush". One or two layers over a background works.

1. **Roles per section.** Each section is built from:
   - one **world** (`chooseWorld`, which lasts about `TUNE.worldSecs` and then rests);
   - one **lead** layer, held for the whole section;
   - one **accent** layer that fires on its trigger;
   - at most one **hit**;
   - optionally a **lens**.

   `recast()` in `cast.js` does the choosing, via `scoreElems`, `chooseAccent` and `chooseHit`, each asking the registry.
2. **Sections** (`sections.js`). A running fingerprint of the music (kick density, stabs, brightness, bass, melody, loudness) is compared against its recent average.
   - A lasting change becomes a new section on the next downbeat.
   - Sections that come back are recognised (`matchType`) and restore their cast, recipe and colour.
   - From the third visit on, a returning section varies its accent or hit (`varySmall`).
3. **Recipes** (`recipes.js`). `recipeOf()` reads a preset as ingredients: lead, accent, hit, lens, world, motion and movers.
   - `pickRecipe()` chooses one per section to suit the music, the world and the intensity, and avoids repeats and tired leads.
   - The recipe's motion is blended 50/50 with Journey's own, and its movers run during Journey.
   - Hand edits to presets carry into Journey.
4. **Lens.** A section's lens comes from its recipe, or occasionally from the section itself.
   - It switches on and off on bar lines, with hysteresis (`TUNE.lensOn` / `lensOff`).
   - It's never used over a world.
   - On intense phrase lines its fold count shifts.
5. **Transitions** (`transitions.js`). `pickStyle()` decides per section whether changes **fade** or **cut** (`TUNE.cutThreshold`).
   - A cut holds each switch until the next downbeat, then snaps it in with a pulse and wipes outgoing trails.
   - Drops and Nudge always cut. World rests always fade.
6. **Progression** (`progression.js`). With no musical change for `TUNE.progressBeats` beats (about 16 bars, scaled by Evolution speed), Journey takes one step on a phrase line:
   - first a new accent or hit;
   - then a colour, lens or pace shift;
   - then a new recipe and lead.

   **Adaptive sensitivity** (`stillness()`): the longer nothing changes, the smaller a change needs to be to count as a new section. **Fatigue** (`J.fat`) builds while a layer is on screen and counts against choosing it again. Worlds, and the black rest between them, have their own fatigue (`J.wFat`, weighted by `TUNE.worldFatigueWeight`). Without it, a long steady track got the same world after every rest (on minimal techno, the city), and sometimes a second black rest in a row.
7. **Pace** (`pace.js`). Each section gets a pace from 0 (floating) to 1 (frantic), contrasting with the last. `setPace()` maps it (ranges in `TUNE.pace`) to:
   - motion speed, applied through `S.MT`;
   - kick strength;
   - pulse division: once a bar, every other beat, or every beat;
   - how closely shapes follow the audio.

   Hits still age in real time. Manual mode runs at pace 1.

## Timing: kicks, stabs, and the beat grid

- **Onsets** (`audio/analysis.js`): kicks are sudden rises in the low band, and stabs are rises in the mids. Kicks feed the beat grid; stabs fire `onHitFX` (`stab` hits, "on stabs" accents).
- **Beat grid** (`audio/beatgrid.js`: `G`, `gridKick` / `gridTick` / `gridFrame`; tolerances in `TUNE.grid`):
  - **Tempo.** `estimatePeriod` finds the beat length that best explains the gaps between recent kicks as whole numbers of beats.
  - **Clock.** It locks after three kicks on the grid, and each on-grid kick nudges it back into phase. It keeps ticking through missed kicks and breakdowns (about `holdSecs`).
  - **Downbeat.** It's learned from where claps fall (2 and 4) and where crashes and changes land (the 1). It only moves after consistent evidence.
  - **Resets.** Seek, pause or play re-lock the phase but keep the tempo. A new track resets everything.
- **What follows the grid.** `gridBeat(pos)` is the single per-beat hook, with pos 0 = the downbeat. It drives:
  - the pulse (`firePulse`) and downbeat hits;
  - each visual's `onBeat`;
  - cuts, bar and phrase accents;
  - section changes, spin reversals and progression.

  Until the grid locks, detected kicks drive it directly.
- **Sync with real audio.** The grid ticks `G.lead` seconds ahead of the kicks as detected. `G.lead` is the sum of:
  - plus the analyser's delay (half its window);
  - plus the screen's delay (`TUNE.sync.displayMs`);
  - minus the speakers' delay (`outputLatency`, which is big on Bluetooth);
  - minus the user's **Sync** slider (`S.syncMs`, remembered in `localStorage`).

  With the built-in beat there's nothing to hear, so `G.lead` is 0.
- **The pulse lands on the kick.** The kick's flash is in the display pass (`c*=1+uBeat*…`, and the matching second draw in simple mode), not in the trails. Brightness added in the trails builds up over the next frames and peaked about 8 frames late. So beat-driven brightness doesn't go in the feedback pass. `tests/sync.mjs` checks both.
- **Phrases.** 4-bar lines are counted from the first bar of the current section (`J.phraseAnchor`).

## Conventions

- **Style.** Match the existing code: dense modern JS, short names (`J`, `G`, `P`, `eff`, `jState`, `tgt`), and one-line comments that say *why* in plain words. Each module starts with a one-line comment saying what it is.
- **State.**
  - `curP` holds the current settings and `eff` holds them after movers.
  - `S.active` is the preset in use; in Journey it's `jState`, which Journey writes to.
  - A variable reassigned from more than one module goes on `S`, because ES module imports are read-only.
- **Tuning.** Feel numbers go in `src/tuning.js`, not inline.
- **Accessibility.** Respect `reduceMotion`, which halves flashes. Keep the UI usable at phone width.
- **Narration.** The Adjust panel narrates Journey (`updateSectionUI`, `#jGrid`). Keep it accurate when behaviour changes.

## Media and the mirror tunnel

The mirror tunnel (`src/visuals/layers/tunnel.js`) is a three-mirror tube kaleidoscope.
- **Folding:** `foldTri` reflects each point back into a triangle, which tiles the view endlessly.
- **Orb:** the tiled view can be bent onto a lit sphere (`TUNE.tunnel.orb`).
- **What's in the tube:** whatever is in `MEDIA`. With no media, it shows built-in rods and beads that move with the music.
- **Sources:**
  - dropped videos and images (the file picker accepts them too);
  - the **Camera** button (`getUserMedia`, back camera on phones);
  - a video's own sound drives the analysis when no music is loaded.
- **Journey:** while media is loaded the tunnel is the lead: the chosen lead is muted and worlds rest.
- **Drawing:** in WebGL it's blended over the trails (not added), so pictures stay recognisable. Its media texture uses texture unit 3, and a still image uploads once. Simple mode draws a six-way mirror.
- **Caveat:** hosts that sandbox the page (possibly the claude.ai Artifact) may block the camera; files still work.

## Meshes: the wire skull, the unicorn and the maths shapes

**The mesh engine** (`src/render/mesh.js`, a leaf module) draws any triangle mesh as glowing wire edges over dark glass panes.
- **Data.** A mesh is `{pieces: [{pos, tri, part, hinge?}], hinge}`. `panesOf()` turns it into panes, each with its corners, centre, normal, part, piece and a fixed random seed.
- **Per-pane motion.** It's worked out in the vertex shader, and again in JavaScript for simple mode:
  - a hinged piece rotates about `hinge` (the jaw);
  - panes fly out along their normals, spinning about their own centres (`ex`);
  - panes vanish by seed (`gone`);
  - a band of light runs down the object (`sweep`);
  - random panes flash (`spark`).
- **WebGL drawing.**
  - Edges are drawn as screen-space bands, because WebGL lines are only 1 px wide.
  - On screen it's three passes: the far side's edges faintly (`xray`), then the panes (depth-tested, darkening what's behind them), then the near edges.
  - Into the trails it draws edges only (`trail`). The trail buffers have no depth.
- **Simple mode.** The panes are painted back to front, each as dark glass followed by its lit edges.
- **Setup.** The main canvas asks for a depth buffer for this.

**Generated meshes** live in `src/visuals/objects/meshes/*.js` and aren't edited by hand. `npm run mesh` runs `tools/skull-mesh.mjs` and `tools/unicorn-mesh.mjs`, which share `tools/mesh-kit.mjs`. The skull tool:
- describes a detailed skull as distance functions;
- meshes it with `isosurface`;
- simplifies it with `meshoptimizer` to about 900 panes for the skull and 260 for the jaw. Both are dev dependencies; the page has none.
- tags every pane with its part: 1 cranium, 2 face, 3 cheekbones, 4 jaw, 5 teeth, 6 brow, 7 eye sockets, 8 nose.
- The sockets and nose are drawn as dark holes, and the sockets glow on the downbeat.
- **Replacing the skull.** A free-licence skull model couldn't be fetched here (those hosts are blocked). A real model can replace this mesh: convert it to the same `{pos, tri, part}` arrays, and nothing else needs to change.

**The unicorn** (`tools/unicorn-mesh.mjs`) is built the same way.
- **Pose:** it prances, facing +z like the skull, with one foreleg raised, a three-strand tail, a mane, ears and a spiral horn.
- **Pieces:** the body (760 panes), and the head with its neck (480). The head nods on the pulse about the neck's base.
- **Parts:** 1 body, 2 head and neck, 3 legs, 4 mane and tail, 5 horn, 6 hooves, 7 eyes (dark, glowing on the downbeat).

**The maths shapes** (`meshes/maths.js`) are worked out when the page loads, not generated:
- a geodesic sphere (320 panes);
- a torus (768);
- a (2,3) torus knot (1,680);
- a dodecahedron (60);
- a spiky star (60, key `spikes`, because `star` is the star-flash hit).

Every pane faces away from its own inside point: the centre, or for the tube shapes the tube's centre. Parts band the panes into six colours.

**Every mesh object** is made by `meshObject({key, label, words, mesh})` in `objects/mesh-object.js`. `skull.js` and `unicorn.js` are one call each, and `objects/maths.js` makes all five maths shapes (the registry spreads its array). To add a shape, make a mesh and add a `meshObject` call. Then give it a line in `TUNE` (`chance`, `size`, `hinge`) and a registry entry.

**What every mesh object does** (the skull's behaviour, now shared):
- **Music:**
  - it turns at motion time (`spin`);
  - its hinged piece (the jaw, the head) swings on the pulse;
  - a band of light runs down it each downbeat;
  - a scatter of panes flashes on stabs, and the parts' colours move round the wheel.
- **Arriving and leaving.** It arrives by assembling out of flying panes. When it leaves, its panes wink out.
- **Shattering.** It shatters on a drop, a new section or a progression step (every 8 bars when playing by hand), then pulls back together over `explodeSecs`. `breakApart()` does it on demand.
- **Journey.** Any object can be a section's optional **centrepiece** (`J.centre`, chosen in `recast` and remembered with the cast):
  - the lead steps back to 70%;
  - there's never a lens over it;
  - the mirror tunnel wins while media is loaded.

  Every object is off by default (`chance: 0`). `?lab=skull` gives the skull .5; `?lab=objects` gives every object an equal share of about half the sections.
- **Manual:** the "Skull", "Unicorn" and "Torus knot" presets (`journey:false`). Every object also has a slider under "Media and objects".

## Experiments

Everything here is opt-in from the URL, so the normal page is unaffected:
- `?tune=path=value` overrides a `TUNE` number, e.g. `?tune=hitNone=.4&tune=pace.divBar=.2`. Use it for quick feel comparisons.
- `?lab=name` loads `src/lab/name.js` before the first frame and calls its default export with `{TUNE, J, PACE, registry}`. Use it for trying an idea on one branch without touching the defaults; `src/lab/example.js` is a template. Labs are bundled into the build too.
- `?seed=N` makes a run repeatable.
- For bigger ideas, use one branch per idea.

## Testing

Run `npm test` before every PR (`npm run test:dist` also builds and tests the bundle). Tests use headless Chromium via the global Playwright (`npm root -g`).
- `tests/smoke.mjs`: the page loads, draws and locks the beat grid in both renderers with no errors, and `?lab=` / `?tune=` apply.
- `tests/media.mjs`: an image and Chromium's fake camera (`FAKE_CAMERA` flags in `lib.mjs`) show through the tunnel in both renderers, and Journey hands it the lead and takes it back.
- `tests/sync.mjs`:
  - with real audio through the analyser, a synthetic loop in real time, the pulse is drawn a screen's delay before the kick is heard;
  - the kick frame is the brightest;
  - each "follows" mover moves with its own part of the groove.
- `tests/objects.mjs`: every mesh object draws and shatters in both renderers, and with `?lab=skull` Journey casts the skull as a centrepiece, never under a lens.
- `tests/grid.mjs`: on the synthetic groove, the grid must:
  - lock;
  - hold the tempo within 0.5 BPM;
  - time beats within 15 ms;
  - find the real downbeat at a steady tempo.
- `tests/journey.mjs`: over 400 simulated sections:
  - every world and hit is chosen;
  - nearly every recipe is;
  - hits appear in 15–40% of sections.
- `tests/golden.mjs`: a **deterministic** run on the synthetic groove (`tests/fixtures/groove.js`), with a seeded `Math.random` and a fake 60 fps clock stepped by the test. It compares Journey's `__jdbg()` timeline (180 s in simple mode, 45 s in WebGL) and canvas thumbnails against `tests/golden/*.json`.
  - A refactor must match the recording exactly.
  - An intended behaviour change re-records it (`npm run golden:update`), and the PR says why.

`tests/lib.mjs` has the helpers:
- `serve`;
- `launch` (WebGL via swiftshader, or simple mode);
- `openPage` (seed, clock, groove, query);
- `THUMB`.

Tests reach internals by importing the modules in the page (`await import('/src/journey/core.js')`), which gives the same instances the app uses.

Useful facts:
- **Built-in beat.** With no track loaded, `synth()` generates a steady 120 bpm kick, so the page reacts without audio. Tests set `window.__synth` to feed their own groove.
- **Debug state.** `window.__jdbg()` returns Journey's state: recipe, lead, accent, hit, world, lens, pace, grid, fatigue, progression and more.
- **Software WebGL is slow** (about 6 fps). Use deterministic stepping (`__step(n)` in tests) for timing, and WebGL for screenshots and shader checks.
- **Checking one visual.** In manual mode (press `A` to leave Journey), set every slider to 0 except the one under test, then compare frames.
- **Scratch harnesses** go in the scratchpad, not the repo.

## Known limits

- **Tuned on synthetic audio.** Real-music tuning comes from the user's listening feedback.
- **Downbeat after a tempo change.** It can slip to beat 3 and stay there. `tests/grid.mjs` reports it (about 47% right after the change in the groove).
- **Unsure downbeat.** Minimal techno with no clap or crash may never pin the 1; the panel says "unsure of the 1".
- **History.** Earlier work, oldest first:
  - a WebGL-failure fix, simple mode, movers, comets and shockwaves;
  - Journey, onset-based kicks and stabs, section fingerprints;
  - three-role layering, cut transitions and the star;
  - recipes and lens, progression and fatigue, the beat grid;
  - aurora, city, outline and sparkles, and pace;
  - then the modular restructure with its registry, tuning file and tests.

  `git log` has the details.
