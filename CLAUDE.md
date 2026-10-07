# Afterglow visualiser

A music visualiser that runs entirely in the browser. You drop in MP3s, it analyses them live with Web Audio, and it draws a glowing feedback piece that follows the music. Its automatic director, **Journey**, decides what appears, when, and how it moves.

- The code is plain ES modules with no runtime dependencies. The only external request is the Chakra Petch font.
- **Develop:** run `npm run serve` (which runs `python3 -m http.server`) and open `index.html`. Modules don't load from `file://`.
- **Publish:** the published copy is a claude.ai Artifact: https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ. `npm run build` bundles everything into one self-contained `dist/afterglow.html` (esbuild, the only dev dependency). The steps are in the `publish` skill.
- **Skills** (`.claude/skills/`):
  - `publish`: build, test the bundle, republish;
  - `check-visual`: one visual alone in both renderers, with stills (`tools/look.mjs`);
  - `track-run`: a real track through the page offline, and what the grid and Journey did (`tools/track-run.mjs`);
  - `taste-review`: the user's 👍 / 👎 moments from the published page, turned into `docs/taste.md` and tuning.
  - `next-idea`: build the top idea from `docs/ideas.md` on its own branch, with a preview and a pull request (for a scheduled builder);
  - `blender-object`: model an object in Blender (or take the user's .glb) and bring it in, with a shape key it plays on the beat.
- **Taste:** `docs/taste.md` holds what the user likes and doesn't, with evidence. Read it before changing how anything looks or behaves, and add to it when the user reacts.
- **Voice:** an experiment, set aside by the user: the page Afterglow Voice (https://claude.ai/artifact/HBgUQnbG3XJEeNQ22XKgGi, `tools/voice/afterglow-voice.html`) reads aloud whatever is in its database document `voice/latest`. Pages can't use the microphone, so it never became a spoken back-and-forth. Don't write to it unless asked.
- **Audience:** the user tests with real tracks, mostly minimal techno. Most feedback is about how it *feels* over a whole set: busy vs sparse, fast vs calm, repetitive vs progressing.

## Layout

```
index.html, styles.css     markup and styles; index.html also handles ?seed= and shows errors
src/main.js                boot and the render loop: builds P each frame and hands it to a renderer
src/state.js               shared buffers, and S: the few variables several modules reassign (S.beat, S.active, S.MT …)
src/tuning.js              TUNE: every feel number, one commented line each
src/lab.js, src/lab/       ?tune= and ?lab= experiment hooks (src/lab/example.js shows a lab; cosmos, terrain, skull, objects)
src/presets.js             SPEC (settings and sliders, partly from the registry), movers, BASE presets/recipes
src/util.js                $, maths, colour (hc, hsv2rgb), noise
src/visuals/registry.js    lists every world, hit, layer and object; everything else is built from it
src/visuals/worlds|hits|layers|objects/*.js   one module per visual (see below)
src/render/                gl.js (WebGL passes), canvas2d.js (simple mode), compose.js (builds both shaders from the registry), shaders.js (fixed programs), mesh.js (3D meshes as wire and glass panes), lit.js (Blender models baked for real time, textured under moving lights), quality.js (resolution that follows the frame rate)
src/journey/               core (J, jState), sections, worlds, cast, recipes, transitions, progression, pace, steer (pins, bans, hold), director (stepJourney, __jdbg)
src/audio/                 player, dj (two decks and a mixer: DJ mode), analysis (levels, onsets), listen (texture: hats, noise, bass, filter, notes, width, bar memory), foresee (the track read ahead: its beat map and drops), synth (built-in beat), beatgrid (tempo, the low end's pulse, clock, downbeat, gridBeat)
src/fx/                    particles (flow), effects (comets, shockwave motion, stabs), pulse, movers
src/media/source.js        MEDIA: the video, image or camera feeding the mirror tunnel (a leaf module)
src/scene/                 dance.js (the choreographer: every layer and object dances), signals.js (the signal bus), tweaks.js (each layer's own speed, size and sound), graph.js (scenes → draw plans), templates.js (Journey's scene templates), context.js (palette, wind, light), camera.js (a 3D camera on springs, and its shots)
src/ui/                    panel (sliders, narration), scene (the scene editor), presets (switch/randomize), controls (Space, arrows and the other single keys, pad, buttons), keys (the keyboard's groups and strip), fly (the cosmos camera's keys), transport, toast, fps (the frame-rate readout), caption (what a world's camera is doing), taste (👍 / 👎 moments), dj (the DJ panel under the picture)
tests/                     npm test: smoke, media, objects, scene, sync, grid, listen, foresee, beatmap, visuals, journey, quality, cosmos, dance, steer, dj, golden (see Testing)
docs/composition-plan.md   the staged rebuild around composition, with its log
tools/build.mjs            the bundler for dist/afterglow.html
tools/*-mesh.mjs           make the skull's and unicorn's meshes (npm run mesh), using tools/mesh-kit.mjs
tools/blender/*.py         objects modelled in Blender (the manta), exported as .glb; the lit assets (lit_kit.py, goblin_hd.py, tentacle.py, hand.py, heart.py) and lit_export.py
tools/import-glb.mjs       a .glb from Blender into a mesh file (parts from materials, a shape key as the morph)
tools/look.mjs             one visual alone in both renderers, saved as stills (the check-visual skill)
tools/track-run.mjs        a real track through the page offline, with a summary (the track-run skill)
.claude/skills/            publish, check-visual, track-run, taste-review, next-idea, blender-object
docs/taste.md              the user's taste: principles with their evidence, open questions, a log
docs/ideas.md              the backlog of ideas to build, in the user's order (the next-idea skill takes the top one)
tools/strip.mjs            a motion strip and measures of feel (brightness, lit, detail, motion, flashes, things on screen)
tools/bench.mjs            speed per scene, with thumbnails proving the picture didn't change (--compare, --root)
docs/audit-speed.md        the 2026-09 speed audit: what was found, done, and left
```

## How it draws

- **Everything is composed.** Each frame draws the current **scene** (see Scenes below): a stack, bottom to top, that `scene/graph.js` compiles into a **draw plan**, which both renderers run step by step:
  - **trail passes**, one per trail group: the group's last frame zoomed, spun, warped, faded (`decay`) and pushed by the wind, with the group's own layers drawn on top. This is what makes the glowing trails. In WebGL each group ping-pongs between two framebuffers.
  - **segments**: a run of flat entries (worlds, their front planes, trail groups, hits) drawn in one full-screen pass over the picture so far. `render/compose.js` builds each segment's shader from the registry, once per shape of run, and caches it.
  - **object draws** between segments. When something is drawn over an object later, WebGL builds the picture on a surface with depth and the next segment reads it back.
  - small **fill and mask** passes at half size, only when a scene uses them.
- **The finish** (`TUNE.render`). Trail groups and surfaces are half-float where the device can render to it (`detectHdr`), so tails fade smoothly (the trails themselves still clamp at 1; brightness above 1 survives on the surfaces, for the roll-off). The trails are drawn at `trailScale` (¾) of the screen's resolution, since they're soft anyway; the last frame is softened slightly as it's read back (`trailSoft`), so fast shapes smear. After the whole scene: the bright parts are picked out at quarter size, blurred both ways and added back as a glow (`bloom`), bright colours roll off softly instead of clipping to white (`knee`), and a dither hides banding. Simple mode gets the glow too, from a contrast filter and a blur on a quarter-size copy. Fast thin shapes (ribbons, the horizon grid) still leave separate echo lines: that's the feedback itself, and would need drawing them twice a frame.
- **Crisp layers.** Worlds (backgrounds) and hits are drawn in segments every frame, *outside* the trails, so they never smear. Anything that has to appear or vanish cleanly belongs there.
- **Simple mode.** `render/canvas2d.js` (`make2D`) is a Canvas 2D fallback for browsers without WebGL. **Every visual needs a version in both renderers.** The 2D one can be plainer.
- **Robustness.** Drawing is capped at 60 fps (feel numbers are per frame). A lost WebGL context stops drawing and is rebuilt on restore (visuals with their own GL objects check `S.glGen`). Resizes are debounced. The trails' shader skips every visual whose weight is 0, and every template's segment shaders are compiled while the page is idle (`warmScenes`).
- **Speed.** These keep it quick as visuals are added:
  - **The trails' shader holds only what's drawing.** It runs for every pixel of every trail group, so each visual in it cost something even at weight 0. `fbPick()` in `gl.js` builds one from the visuals with weight (and any a fill shows), kept for `TUNE.render.fbLinger` after they stop so accents don't swap shaders, and cached per set (`fbCache`; 0 turns this off). While a new one compiles in the background (`KHR_parallel_shader_compile`, or `fbWait`), the smallest ready one that covers the set is used, or the full one, which is always there. In software WebGL this took a plain section from about 6–7 to 9–11 fps. `tests/quality.mjs` checks it draws exactly what the full one does.
  - **The graphics level** (the panel's **Graphics**, or **Q**; `GFX`, `setGfx` in `render/quality.js`, remembered on the device in `localStorage`: `afterglow.gfx`). The user found it slow, most when the cosmos came in, and the picture "switching every time" they opened it. **Auto** is the frame-rate following below, starting from what it settled on last time (`afterglow.gfxAuto`) instead of full size each visit; **Best**, **Balanced**, **Fast** and **Fastest** are fixed (`TUNE.render.gfx`: the share of the screen drawn, the share a heavy world is drawn at, the trails' resolution) and never switch. The heavy worlds are the cosmos and the five 3D worlds (`heavy`, `lowRes` on each): drawn smaller first, while the glow, hits and objects over them stay sharp (drawn smaller, a 3D world's walls lose the layers laid on them). The frame-rate readout names the level.
  - **The resolution follows the frame rate** (`render/quality.js`, `TUNE.render.auto`). Under `low` fps for `slowN` seconds running (so one hitch doesn't count), it draws a step smaller (×`step`, down to `min`; the canvas is stretched to fit, and the main trails are carried across); at `high` for `upMs`, a step back up. A step up that's slow again within `probeMs` is taken back and not tried again for `ceilMs`. It waits `graceMs` at the start, while shaders compile. The readout says when it's lowered.
  - **A heavy world draws smaller than the rest, only when it must** (`lowRes(P)` and `heavy(P)` on a world; `lowPass` in `gl.js`). Below full size it's drawn once, alone, into its own picture (texture unit 8, used only where the device has more than 8), and every segment reads it back stretched (`uLow`), while the glow, hits and objects over it stay at full size. The cosmos is heavy (in space and landed): when frames run slow while it's on screen, `quality.js` steps it down first (`Q.world`, to `TUNE.render.auto.worldMin`), before the whole picture, and brings it back last; the readout says "the cosmos at N%". A fast device keeps it at full size (`TUNE.cosmos.landScale` and `scale` are 1).
  - **Shaders compile without stalling a frame.** The user's laptop froze for up to 30 s at scene changes (the music played on): the page waited for a shader, and Direct3D's compiler (Chrome on Windows) takes seconds over a big one, building them one at a time. Measured offline (Journey nudged every 5 s, each frame timed in real time), the waits were 1–6 s, once 42 s. Now nothing waits once a scene has drawn (`canWait` in `gl.js`: only the very first frame may). Segment programs are started and left to the driver (`KHR_parallel_shader_compile`), linked once done; meanwhile a ready program for the same run stands in, the one holding most of the worlds wanted (a big world coming in shows once its own is built), and with none `drawGL` keeps drawing the last scene that could draw (`lastSc`). `warmScenes` builds each template's runs at idle without the big worlds only (it used to build each with all 14 worlds too, `'*'`, 110 KB a shader, which queued ahead of what was needed). The mesh and lit objects' programs are started at idle (`meshWarm`, `litWarm`) and an object isn't drawn until its program is built; each mesh's vertex data is worked out at idle too (`meshData`).
  - **Work that can't show is skipped** (the 2026-09 speed audit, `docs/audit-speed.md`): every shader skips what the picture can't show, with no change to what's drawn. Worlds shade only the nearest building row or ridge that covers a pixel, and draw their sky only where nothing covers it. A front plane in its own segment (an object between a world's planes) works out the world only where the front covers the pixel. Belt gas, dust and rock clumping are looked up only where they can appear. Cloud and gas noise stop as soon as the octaves left can't lift them past their threshold (`czFt`). The ground's valley floor skips the mountains. Trails skip the second fold count with mirror off. Shockwaves, comets and orbits skip where they add nothing, and the tunnel's folding stops once a point is settled.
  - **Frame pacing:** the 60 fps cap runs on a deadline, so 75, 90 and 144 Hz screens draw 60 a second (they drew 37–48, which the auto resolution then took for a slow device).
  - **Measuring:** `tools/bench.mjs` times fixed scenes (Journey, kaleidoscope, city, skull, aurora, space, a planet, the belt, landed) in headless Chromium, and takes a thumbnail of each at the same moment every run: `--compare` a saved run to see the speed-up and whether the picture changed (0: it didn't). `--root` runs another checkout the same way (a worktree of `main`).
- **Frame rate.** `ui/fps.js` shows frames drawn a second (green at 55+, amber at 30+, red below), the longest gap between frames, the script's time per frame, the renderer and its size, and what's on screen. It's on until hidden with **P** or the panel's "Show frame rate" (remembered in `localStorage`). In WebGL the script time leaves out the GPU's work, so a low fps with little script time means the shaders are the cost.
- **Parameters.** `render()` in `main.js` builds `P` each frame. Each visual's `params()` adds its own fields. `t` is *motion time* (`S.MT`), not wall time; see Pace below.

## Visuals and the registry

| Kind | What it is | Modules | How it arrives |
|---|---|---|---|
| **Worlds** | Backgrounds, crisp (display pass) | `land`, `space`, `aurora`, `city`, `cosmos` (a 3D place; see The cosmos), `sea` (the paper sea), `deep` (the paper reef), `dunes`, `forest` (the paper forest), `hollow`, `cathedral`, `vessel`, `geode` and `corridor` (3D places flown through: see The 3D worlds) (plus none/black) | Fade, or cut on the bar |
| **Layers** | Continuous glowing effects in the trails (feedback pass); every one dances (see Dance) | `ring`, `scope`, `plasma`, `burst`, `comets` (they trace shapes: roses, Lissajous knots, stars, spirals), `flow`, `ribbons`, `horizon`, `orbit` (flares circling a world's subject), `lasers` (club beams: a fan, crossing, a star, a scan, changing every two bars), `lines` (waveform lines, the Unknown Pleasures stack, the nearer hiding the farther), `fireflies` (soft out-of-focus lights drifting on the wind, blinking livelier with the hi-hats), `stargate` (hexagon rings rushing out of the centre, one a beat, faster as the tension builds), `vectorscope` (the left channel against the right, from `scopeLR` in `state.js`: mono stands upright, wide sound opens out), `mandala` (the flower of life drawing itself arc by arc over each four-bar phrase, turning a notch each bar: the seed's 7 circles, the flower's 19 or 37 by the mandala detail), `mood` (the mood ring: a halo round the subject in its own colour, not the palette's: the key round the circle of fifths sets the hue, tone against noise the richness, fullness the brightness, shifting over several seconds), `rain` (slanted streaks, heavier with the hi-hats and the noise, blown by the wind, splashing on the kick), `constellation` (stars joined one line a beat into a figure, a new figure every few bars), `unfold` (the unfolding Indian mandala: a lotus at the heart opening and closing with the bar, and rings born round it every `TUNE.unfold.barsPerRing` bars that grow outwards for ever, each its own motif and number of folds: lotus petals, beads, arches, temple teeth, paisley teardrops, a vine, or animals in facing pairs (elephants with raised trunks, fish, doves); the **Mandala detail** setting (`mandDetail`, simple to intricate, in its own group) adds folds and ornament: doubled petals, veins, inner arches, saddle cloths, scales), `fractal` (an endless dive into a snowflake fractal, branches carrying smaller branches: four octaves nested, each growing out of the heart of the last and fading past the screen's edge, so the fall never ends; each octave is born with its own folds, angle and branching from the music at that moment (calm few folds, intense more), the tension sets the speed of the fall (`TUNE.fractal`), a drop surges it, each kick sends a flash racing out through the octaves, the bass swells the branches; the **Fractal vortex** setting (`fracVortex`) twists the dive into a logarithmic whirlpool that spins as it falls, turning the other way after each drop; simple mode draws it at low resolution) | Fade, or cut on the bar |
| **Hits** | One-shot shapes fired by the music | `star` and `outline` (downbeat), `sparkle` (stabs), `shock` (pulse; drawn in the trails), `lightning` (a forked bolt on stabs, lighting everything an instant), `glitch` (the finished picture slices sideways and its colours split, always on a drop, and on some downbeats; it draws nothing itself, the finish moves the picture) | Snap in, then snap or flicker out |
| **Objects** | 3D centrepieces, crisp: meshes, placed anywhere in the scene (on top by default) | `skull`, `unicorn`, the maths shapes `geosphere`, `torus`, `knot`, `dodeca`, `spikes`, and `manta` (a Blender model whose wings beat with the bar); the lit objects `goblinLit`, `tentacle`, `hand`, `heart` (Blender sculpts, textured, under moving lights, in five looks: see Lit objects) | Assembles out of flying panes; shatters and reassembles; panes wink out as it leaves (a lit object fades, and startles instead of shattering) |
| **Opt-in** | Drawn and given a slider, but outside Journey's layer pool (`optIn: true`) | `tunnel` (the mirror tunnel), every object | The tunnel comes in as the lead while media is loaded; objects come in as centrepieces (`TUNE.scene.centreChance`) |
| **Lens** | Transforms everything, draws nothing itself | `sym` (the glow's own folds, in the trails), `mirror` in `SPEC` | Eases in, or flips on the bar |
| **Kaleidoscope** | A mirror fold of the picture itself (see The kaleidoscope) | `kal`, `kalWhere`, `kalTurn`, `kalMode` in `SPEC` (by hand, and Journey's extras) | Unfolds over about a bar |
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
  - A mesh object, made by `meshObject()` in `objects/mesh-object.js`: `drawGL(gl, P, W, H, stage)` is called twice a frame. With `'trails'` it draws into the feedback buffer, so the object leaves ghosts (off by default since the user found the streaks distracting: `TUNE.mesh.trail` 0 skips it); with `'screen'` it draws over the finished picture. It also has `draw2d(o, P)`. Both hand off to `render/mesh.js`.
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

- **Movers** (`mods` on a preset): per-setting automation. Any setting can follow any signal on the bus (`scene/signals.js`): drift, bass, mids, treble, the pace's pulse, jumps, every kick, stabs, loudness, the beat and bar ramps, energy, or a section change.
  - "Follows" uses `bands` from `audio/analysis.js`: each band's level against its own recent quiet and loud (0..1). So bass pumps with the kick, mids with claps and stabs, and treble with hats and crashes. The raw levels mostly sit high and barely move, so they're no good for this.
  - A mover set by hand during Journey goes in `J.userMods`, and `recipeMods()` keeps it from section to section.
- **Presets** (`BASE`, 44 of them: 30 Journey reads as **recipes** (among them "Unfolding", "Fractal", "Orbits": flares round the cosmos's planets, "Lasers", "Pleasures", one for each new world and layer: "Moonlit sea", "Deep water", "Desert night", "Glowing wood", "Night rain", "Star map" and more), and 14 manual-only looks and demos with `journey: false`, among them "Cosmos", the cosmos alone, "Vortex", the fractal's vortex, and "Manta").
- **Each layer's own speed, size and sound** (`scene/tweaks.js`, `S.active.tw[key] = {speed, size, src}`): a row under a layer's slider while it's on, or the keys (← → speed, Shift+← → size, B what it follows). Kept on the preset, carried into Journey, snapshots and likes. Journey sets its own for the lead and accent in some sections (marked `j`, see Journey's extras), never over one set by hand; a hand edit makes one the user's. Speed is the layer's own clock (`TW[key].off`, motion seconds ahead: its `params` get `x.t` shifted, the ribbons', horizon's, comets' and flow's steps are scaled, and in WebGL its code's `uTime` reads `uTw_<key>.x`); size scales its coordinates round the centre (`uSz_<key>`; simple mode scales the canvas); the sound replaces its bass, mids and treble with one signal (`uTw_<key>.yzw`, and a copy of `P` in simple mode). `compose.js` rewrites each layer's code for this; untweaked it reads exactly the shared values. The ring, scope and burst have no clock (`tweaks: ['size', 'src']`).

## Dance: every layer and object moves to the music

The user found the layers "repeating the same patterns again and again" and the skull "always doing the same thing" (turning, jaw on every pulse, shattering and coming back), and asked for them to improvise and dance. Then they found the dance "janky" (too much side-to-side and yo-yoing, things drifting off centre) and asked for symmetry to drive the composition: now every move is symmetric and stays centred, and the springs ease into each pose. `src/scene/dance.js` (a leaf module; tuning in `TUNE.dance`) is a choreographer:
- **Dancers:** every layer and object on screen (`stepDance`, each frame from `main.js`; `danceBeat`, each beat from the beat grid). It keeps its own random numbers, so Journey's draws are untouched.
- **Moves.**
  - **Layers** (`LAYER_MOVES`), round the picture's centre, never off it: still, rock (turning slowly one way and back over four bars), snap turns (a notch a bar), breathe, spin (the second layer the other way), push (growing through a build), pulse (swelling on the kick), bloom (opening out over four bars).
  - **Objects** (`OBJ_MOVES`), centred (no sideways steps or rolls): still, head bang (a nod on the kick), groove (a bounce with squash and stretch), face (snap turns by the object's own symmetry), look (turning to one side and the other, evenly), pulse, float (rising and sinking), spin (one full turn over four bars, ending face on), lift (one part lifting off and coming back), approach (coming slowly towards us over eight bars and back), rise (tipping back to show its underside, and down again), reach (on a drop only, for reachers: see below).
  - A new move starts from the nearest whole turn (`wrap`), so a spin never unwinds backwards.
- **Choosing.** Each move is scored for calm, intense and breakdown music, and a dancer may change its move every `barsPerMove` bars or at a new section:
  - it avoids repeating itself;
  - an object's character weights the moves;
  - a section remembers its dancers' moves and brings them back when it returns (`remember`), so a returning part dances the same way with variations.
  - Moves grow with the energy, a breakdown stills them, and a drop sends everyone into a spin burst, except the **reachers** (`reach: true` in their character: the hand, the tentacle, the goblins and the skull), which reach out at us instead (`reach`: face on, the top tipping towards us, coming close over a quarter bar, holding a bar, easing back; `TUNE.dance.obj.reach*`), since the user loved them "reaching out towards you".
  - The second layer answers the first (mirrored).
- **Weight.** Moves set targets for springs (`stiff`, `damp` near critical, in small sub-steps), so poses ease in without yo-yoing past.
- **Centred.** The trails' centre barely wanders in Journey (`TUNE.wander`, capped even when a recipe asks for more: it was up to .38 of the screen), and objects hardly sway in the wind (`TUNE.ctx.windObject`).
- **Layers in the renderers.** Each layer's coordinates are turned, shifted and scaled round the trails' centre: `uDn_<key>` (turn, x, y) and `uSz_<key>` (its size times the dance's scale), through `dnT()` in `compose.js`. In simple mode it's `dance2d` in `canvas2d.js`.
- **The comets trace shapes** (`DANCE.comets`, `cometTarget()`), mostly symmetric and concentric (free roaming is rare): a rose (k petals), a Lissajous knot, a star polygon, a spiral (on a drop, bursting outwards), a chase round a loop, a braid, a vortex (circling together as the ring opens and closes: concentric rings), a funnel (spiralling in to the middle and out), wings. The Lissajous knot, the braid and the wings are mirrored: two comets draw each other's reflection and the third the middle line.
- **The flow's particles** (`DANCE.flow`, `FLOWS`, in `fx/particles.js`): drifting on the field, or in mirrored pairs (each odd particle the reflection of the one before) converging from both sides to the middle, swirling round it, or blooming out of it (on a drop). A new way every other phrase, with the comets' shape; `danceFlow(mode)` holds one.
  - They fly into a shape over `shapeIn` and travel half of it a bar (`cometTurns`), so their trails draw the figure, then move on to another every few bars.
  - `effects.js` steers them there and lets them roam free again.
- **Objects** (`DANCE.obj[key]` in `mesh-object.js`): the dance's yaw, nod, roll, step, size, squash and lift are added on top of each object's own motion (the manta keeps its wingbeat). The steady spin is slower (`1 - .6×amount`). Each object has a character (`dance` on `meshObject`):
  - the **skull** head-bangs, glances, pulses and comes towards us, and its cranium lifts off;
  - the **unicorn** prances and its horn lifts;
  - the **manta** comes slowly towards us and back, and tips back to show its belly (its own `approach` and `rise` sizes);
  - the **maths shapes** snap round their own symmetry (fifths for the dodecahedron and sphere, quarters for the torus, thirds for the knot, sixths for the star).
- **Hooks for tests and labs:** `danceShape(shape)` holds the comets in a shape, `danceMove(key, move)` a dancer in a move (`'o:' + key` for an object). `TUNE.dance.amount` 0 stills everything.

## The panel: what's on screen, presets, Solo and Journey

The user found this confusing, so the panel says it plainly:
- **Settings** are the sliders (Motion, Lens, Layers, Hits, Worlds, Colour, Media and objects). Together they are one picture.
- **A preset** is a saved set of every slider (the name in the bottom bar). With Journey off, the sliders are what's drawn.
- **Journey** doesn't play presets whole: it reads them as recipes (see below) and composes each section from roles, writing the sliders itself (they're greyed while it does).
- **On screen** (`showNow` in `ui/panel.js`, twice a second from `main.js`): the top of the panel names what's drawn (worlds, layers, hits, objects, a kaleidoscope) and what set it (Journey's recipe, or the preset). A dot marks those sliders' rows.
- **👍 / 👎** in the bottom bar (or + and −; `ui/taste.js`) save the moment: the cast, the music, the caption and, in the cosmos, the place (system, star, subject, shot), every non-zero setting, and a thumbnail taken at the end of the next drawn frame (`tasteFrame`). On the published page they go to the Artifact's database (collection `moments`, the `db` capability); anywhere else, to `localStorage` (`afterglow.moments`, the last 300).
- **The keyboard** (`ui/keys.js`, rebuilt from first principles after keys had piled up in several places). A letter picks a group and number keys work inside it: **L** layers (1–9 toggle, Z lasers, U waveform lines, I fireflies, J stargate, V vectorscope, Y mandala, Q mood ring, D rain, G constellations, M the unfolding mandala, X the fractal, N guilloché, H string art, P spiral galaxy; ← → the last one's speed, Shift+← → its size, B what it follows), **W** worlds (one at a time; 1–9, then H the Hollow, N the Cathedral, V the Vessel, G the Geode, D the Corridor), **E** hits (toggle), **O** objects (one at a time; 1–9, then J jellyfish, Q crystal, G goblin, U the lit goblin, I tentacle, H hand, B heart; Y their style, M the lit objects' look), **K** the kaleidoscope (2–9 mirrors; E everything, B the world, G the glow, I inside the object; M its kind: wedges, a mirror box, a dive; ← → turning; while Journey runs these steer it, see Steering Journey), **Shift+K** the glow's own folds (2–9, M mirror trails), **S** scene templates (composed from what's on screen, `compose()` in `ui/scene.js`), **C** the cosmos camera (`flyKey()` in `ui/fly.js`: its shots and its own letters). In a group: 0 all off, Shift+number solo, ↑ ↓ the last one touched, Esc leaves (so does `TUNE.keys.idleSecs` untouched, 20 s). In a group ← → never fall through to the next preset (which changes the whole look, world and all: the user found layer changes "changing the world"); outside one they do, and say which preset. A strip at the bottom (`#keyHud`) shows the group's list with its keys and a dot on what's on; **?** opens every key (`#keyHelp`). **While Journey runs, a group's numbers steer it instead** (`journey/steer.js`, see Steering Journey below): keep, never, free again; **0** clears the group; **;** holds the look. Shift+number (solo), ↑ ↓ and the Adjust panel still take over by hand, freezing Journey first (a snapshot), and **A** hands back to Journey, which carries on from the look as set. **[ ]** calmer or more intense (`J.bias`), **, .** evolve slower or faster (`J.speed`). The single keys (Space, ← →, R, A, N, X, H, F, P) stay in `ui/controls.js`, + − in `ui/taste.js`.
- **The tutorial** (`ui/tutorial.js`, **T**, or the welcome screen's button): a card at the top with one thing to try at a time, through the keyboard (Journey off, a group and its numbers, ↑ ↓, a world, scenes, an object, the kaleidoscope, solo, a like, handing back, steering, the cosmos camera). It watches the state and moves on by itself once a step is done (a tick first; it counts its own quarter-second checks, so the tests' fake clock doesn't stall it), or Back, Skip and ✕. Likes announce themselves to it (`afterglow-like`).
- **The walk-throughs** (`LESSONS` in `ui/tutorial.js`, **Shift+T**, the help card's button or the welcome screen's): the user asked for help that walks through combinations, each from a clean slate so it's the same every time. A list of eight, each building one combination a key at a time with the same watching card (glow on the Hollow's walls, comets behind the city's buildings, the neon tentacle in the Corridor, the kaleidoscope round the skull, the city in the skull's glass, a crystal ball in the cosmos, the neon hand in the Geode, steering Journey). Each starts with `cleanSlate()`: Journey off and unsteered, every visual at 0 at once, plain motion, no scene or kaleidoscope, the colours reset (`S.hueSet`) and the trails wiped (`S.wipe`). Start over, Next walk-through and All walk-throughs on the card.
- **Comments** (`ui/comment.js`, 💬 in the bottom bar or **M** outside a group): the user asked to point at a part of the picture and say what needs refining, for Claude to read. A click on the picture places a marker and a box beside it; Enter saves. Each comment keeps the point (`x`, `y`: shares of the screen across and down), the picture at that moment with the point ringed (480×270), and the whole visual state (`momentOf()` in `ui/taste.js`, as a like keeps: what's on screen, the music, every setting and the `look` to bring back). On the published page they go to the Artifact's database (collection `comments`); elsewhere `localStorage` (`afterglow.comments`). The Adjust panel's **Comments** lists them newest first; a tap brings that look back (`restore`), ✕ removes one. To read them: the Artifact's `comments` collection (ArtifactData), each with `text`, `x`, `y`, `thumb`, `state`.
- **Liked looks come back** (`ui/taste.js`). A 👍 also keeps the whole look (`look`: every setting as drawn, its movers, its scene, its template and centrepiece) and a short name. The Adjust panel's **Liked** gallery shows them newest first (live from the database, or this browser's): tap one to bring it back exactly (Journey off, at once), ✎ renames, ✕ twice removes. And Journey reads them as recipes (`LIKED` in `presets.js`, favoured by `TUNE.liked.recipe`), bringing the liked template (`liked.scene`) and centrepiece (`liked.centre`) along when the music suits it: a like steers Journey straight away, besides the `taste-review` skill's slower reading of them all.
- **Adjust freezes.** Opening the Adjust panel during Journey turns Journey off, as below: the user's way of working is Journey, Adjust to freeze a moment and refine it (and 👍 it), then Journey again to carry on.
- **Journey back on carries on from there** (`J.handoff`, `TUNE.handoffSecs`): it holds the hand-made look (its settings, movers and scene) until the music moves it on (a new section, a drop, a progression step, or a phrase line after `handoffSecs`), then fades to its own, instead of jumping there at once.
- **Journey off** (A, or the Journey button) keeps what's on screen as a "Snapshot" preset: the sliders as they're drawn at that moment (not Journey's targets, which it was still easing to), its movers and its scene. What still moves is what moves by hand too: the movers, the cosmos's camera flying with the music, and motion at full pace.
- **Solo** on any picture's slider (`solo()` in `ui/presets.js`) shows that one thing alone: Journey off, every other visual at 0 at once (not faded), no lens, movers or scene.

## Steering Journey

The user asked to direct Journey without stopping it ("point it in directions, add, remove as it goes"). `src/journey/steer.js` holds `STEER`: pinned keys, banned keys, and `hold`.
- **From the keyboard** (`ui/keys.js`, only while Journey runs): in L, W, E, O or S a number cycles its item through keep (pinned), never (banned) and free. The strip marks each: "keep" underlined, never struck through. 0 clears the group's steering. **;** holds, and **R** (`nudge`) moves on. The panel says what's steering (`#jSteer`).
- **The casting honours it:**
  - **Layers:** a pinned layer scores +6 in `scoreElems`, so it's the lead, or the accent when two are pinned. A banned one scores −99.
  - **Hits and worlds:** a pinned hit or world wins its choice (`chooseHit`, `chooseWorld`), a banned one never comes in, and a pinned world never rests.
  - **Objects:** a pinned object is every section's centrepiece (`chooseCentre`); a banned one never is.
  - **Scenes:** a pinned template wins whenever it fits the cast (`pickTemplate`); a banned one is skipped.
  - **The kaleidoscope** (K while Journey runs, `steerKalKey` in `ui/keys.js`): a number keeps one at that many mirrors (`STEER.pin.kal = n`; the same number again frees it), E B G I choose what it folds (`STEER.kalWhere`), 0 bans it (again: free). `steerKal()` in `extras.js` applies it to every section.
  - **Returning sections:** a remembered cast that breaks the steering is recast.
- **Applied at once:** a change goes in straight away (`applySteer` in `cast.js`). A pinned layer takes the lead (or the accent), a banned one leaves its role, and a pinned world, hit, object or scene comes in.
- **Hold:** no new sections, no progression steps and no world rests. The motion, the dance and the music's moment-to-moment reactions carry on.
- **Scope:** steering lasts for the visit, and applies again when Journey is switched back on.

## The kaleidoscope

A true mirror of the picture (`kal`: mirrors, under 2 off; `kalWhere`: what it folds; `kalTurn`: turning; `kalMode`: its kind), round the trails' centre (the world's subject), like the cosmos's own fold. `main.js` builds `P.kal` ({on, where, c, mode, v: [mirrors, share of one more, how far folded, turn], v2: [kind, hall, dive, band]}).
- **Its kinds** (`kalMode`, `kalUv` in `shaders.js`; tuning `TUNE.kal`). The user asked whether the sides all meet at a point (they do) and for a hall of mirrors with a box at the centre, and to zoom in revealing more folds:
  - **wedges** (0): n mirrored wedges meeting at a point;
  - **mirror box** (1): the square round the centre (smaller with more mirrors: `.9/n` of the height) reflected across its walls in every direction, the copies shrinking toward the edges like a hall of mirrors (`hall`; simple mode lays flat tiles);
  - **dive** (2): the wedges, their rings repeating inward mirrored (each `band` of log radius), zooming in for ever (`dive`, faster as the tension rises), so it reveals more folds as it goes (simple mode nests copies).
- **Everything** (0) and **inside the objects** (3) fold in the finish (`FINISH`, `kalUv` in `shaders.js`): the finished picture and its glow are read at the folded place, mirrored back into the picture where it runs off. Inside the objects it's mixed by their silhouettes (`kalPrep` in `gl.js`, a half-size cover pass).
- **The world** (1) and **the glow** (2) fold in the segments (`uKal`, `uKalW`, `uKalT` in `compose.js`): the worlds and their fronts, or the trail groups, read at the folded place; hits and objects stay whole.
- **Simple mode** (`foldOnto` in `canvas2d.js`): the picture (or the worlds, or the glow) copied and laid back as mirrored wedges; it doesn't mirror what runs off the picture, so the far corners can be dark.
- **Keys:** K then 2–9 mirrors; E everything, B the world, G the glow, I inside the object; M the kind; ↑ ↓ more or fewer, ← → turning. Shift+K is the glow's own folds (`sym`, ghostly, in the trails) and M mirrored trails.

**The finish's other effects** (in `FINISH` too, and `finish2d` in simple mode): the glitch hit (`P.glitch`: bands jump sideways, the colours split) and the **film grain** slider (`grain`, a "Finish" group at the end of the settings: grain, scan lines and a little colour fringing). At 0 both leave the picture exactly as it was.

## Journey (the automatic director)

Journey lives in `src/journey/`. The main principle, which came from user feedback: **few things at once.** The user found four or five layers plus kaleidoscope copies "mush". One or two layers over a background works.

1. **Roles per section.** Each section is built from:
   - one **world** (`chooseWorld`, which lasts about `TUNE.worldSecs` and then rests);
   - one **lead** layer, held for the whole section;
   - one **accent** layer that fires on its trigger;
   - at most one **hit**;
   - optionally a **lens**;
   - optionally a 3D **centrepiece**;
   - a **scene** that relates them (see Scenes: Journey composes scenes).

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
   **Extras** (`extras.js`, `TUNE.extras`), so Journey reaches every setting, not only the roles: chosen per section with the cast, kept with it (a returning section brings them back), and narrated in the panel.
   - **The kaleidoscope** (`chooseKal`, `J.kal = {n, where, turn, mode}`, its kind weighted by `mode`): in about a fifth of sections, more when intense, fewer in the cosmos (which folds itself); a recipe with one (`kal` on a preset, or a like) brings it most of the time. What it folds suits the cast (`where`: round a centrepiece mostly inside it, over a world mostly the world, on the black mostly the glow); mirrors from calm to intense; sometimes turning. It unfolds over about a bar (or cuts in on the bar), and while it's on the glow's own folds (the lens) stay off. `varySmall` sometimes brings one in or takes it away. Before this, Journey never used the kaleidoscope at all: the user noticed.
   - **Film grain** (`chooseGrain`): now and then.
   - **Each layer's own speed and size** (`chooseTw`): the lead or accent in about a third of sections; a layer staying in the cast keeps its own.
   - **The mandalas' detail** (`chooseMand`, `J.mand`, `TUNE.extras.mand`): simpler in calm sections, more intricate in intense ones, with a spread of chance.
   - **The fractal's vortex** (`chooseFrac`, `J.fracV`): in about a third of sections (`TUNE.extras.fracVortex`).
6. **Progression** (`progression.js`). With no musical change for `TUNE.progressBeats` beats (about 16 bars, scaled by Evolution speed), Journey takes one step on a phrase line:
   - first a new accent or hit;
   - then a colour, lens, kaleidoscope (`shiftKal`: it comes in, changes its count, or goes) or pace shift;
   - then a new recipe and lead.

   **Energy** (`energyLevel()` in `sections.js`, used for tension and the section fingerprint):
   - It's measured against the loudest the song has been lately, over a range no narrower than `TUNE.energy.minSpan`, blended with an absolute scale (`quiet`, `loud`, `absMix`).
   - Before this, the range could shrink to nothing on a steady track, so full-on minimal techno read as quiet after a minute or two. Tension fell to about 0, the pace to "floating", and tiny wobbles made short false sections.

   **Adaptive sensitivity** (`stillness()`): the longer nothing changes, the smaller a change needs to be to count as a new section. **Fatigue** (`J.fat`) builds while a layer is on screen and counts against choosing it again. Worlds, and the black rest between them, have their own fatigue (`J.wFat`, weighted by `TUNE.worldFatigueWeight`). Without it, a long steady track got the same world after every rest (on minimal techno, the city), and sometimes a second black rest in a row.
   **The set arc** (the panel's "Set arc": off, 30 minutes to 2 hours, from when it's chosen; `arcBias()`, `TUNE.arc`): over the set Journey leans calm to begin with, rises to its most intense about two-thirds through, and winds down to the end, on top of the calm-to-intense slider (`J.biasEff`, which the tension and the pace read). The panel says how far through it is.
7. **Pace** (`pace.js`). Each section gets a pace from 0 (floating) to 1 (frantic), contrasting with the last. `setPace()` maps it (ranges in `TUNE.pace`) to:
   - motion speed, applied through `S.MT`;
   - kick strength;
   - pulse division: once a bar, every other beat, or every beat;
   - how closely shapes follow the audio.

   The pulse rate only changes once the pace is `TUNE.pace.divHyst` past a line, so the pace's gentle breathing doesn't flip it back and forth.

   Hits still age in real time. Manual mode runs at pace 1.

## Timing: kicks, stabs, and the beat grid

- **Onsets** (`audio/analysis.js`): kicks are sudden rises in the low band, and stabs are rises in the mids. Kicks feed the beat grid; stabs fire `onHitFX` (`stab` hits, "on stabs" accents).
  - **Kicks, not bass notes.** Minimal techno puts bass notes between the kicks: on the off-beat, and often a 16th before each kick. They rise in the same low band at about half the kick's strength. A real track showed the detector firing twice a beat, and the grid never locking (29 of 272 s, at 173 BPM for a 130 BPM track).
  - **The fix.** A low-end hit waits a moment (`TUNE.kick.windowMs`, about three frames), because a kick's sub-bass often lands a frame or two after the hit starts. It counts as a kick only if at least `TUNE.kick.subShare` of its weighted rise (`TUNE.kick.weights`) over that moment came in the lowest bin, about 21 Hz. It's timed from its start, so the grid gets no extra lag.
  - **Why a share.** A share rather than a strength doesn't depend on where in the frame the hit fell, which made strength unreliable. Measured over the window: the track's kicks put .15–.32 there, its bass notes mostly under .1, and an 808-style sweep kick (the sync test's) .22–.28.
  - **Result.** The same track now locks for 207 of 272 s, at a median of 129.9 BPM. A few bass notes still get through in busy stretches, but the grid holds.
  - **Test.** `tests/fixtures/offbeat.js` is a synthetic groove built this way, and `tests/grid.mjs` checks it.
  - **Loud masters.** The analyser's bytes stop at -30 dB, and the user's techno goes up to 11 dB past that in the sub-bass (clipped in 27–46% of frames), which flattened every kick. The onsets (and the listening) read the spectrum unclipped in decibels (`freqDb` in `state.js`, from `getFloatFrequencyData`); the bytes (`freq`) stay as they were for the visuals. `LF` is each bin's actual loudness, 1 at -30 dB and above it on loud masters.
- **Beat grid** (`audio/beatgrid.js`: `G`, `gridKick` / `gridTick` / `gridFrame`; tolerances in `TUNE.grid`). A track that was read ahead runs from its beat map instead (see Looking ahead); everything below is the live grid, for the rest:
  - **Tempo.** `estimatePeriod` finds the beat length that best explains the gaps between recent kicks as whole numbers of beats.
  - **The low end's own pulse** (`pulse()`, `G.acP`, `G.acConf`). A rolling bassline ("Mutant Pulse": a note every three sixteenths) puts onsets between the kicks as strong as the kicks, which pass for kicks: the grid locked for 39 s of 203, at 160–170 BPM. So the grid also autocorrelates the rises from 20 to 650 Hz, in decibels, over the last 8 s, every half second: a beat repeats at its own length, twice it and four times it, a bassline's pattern doesn't keep in step with the bar, and the kick is what rises across the whole low end at once. When that pulse is clear (`TUNE.grid.acSure`) the tempo is looked for only within `acNear` of it. Now: 180 of 203 s at 128.1 BPM.
  - **Clock.** It locks after three kicks on the grid (a kick between them is let be, rather than starting the count again), and only when the low end's pulse is clear enough (`acLock`, once 4 s are heard: a slow song's drums otherwise locked a false dance tempo). Each on-grid kick nudges it back into phase; kicks off the grid are let be, and only two bars of kicks with none on it lose the lock. It keeps ticking through missed kicks and breakdowns (about `holdSecs`).
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

## Listening: texture, not just loudness

`audio/listen.js` (a leaf module; what it hears is in `L`), added after running the user's tracks through the page offline: on compressed techno the loudness is a flat line from the intro to the outro, and the parts are told apart by their texture. Fed every frame from the unclipped spectrum (`listenFrame`) and once a bar from the grid (`listenBar`; with no grid, every `noGridBarMs`). Tuning in `TUNE.listen`.
- **What it hears:** `hat` (the top octaves' ticking, in actual loudness, against the most heard lately), `noise` (flatness in the mids: chords make peaks, washes and noise are smooth), `bass` (the 20–150 Hz level in dB against its loudest lately, over half a second so the kick's pumping evens out), `cut` (where 85% of the energy lies below: the filter), `width` (stereo: the side against the whole, from a pair of small analysers on the two channels, `stereo` in `player.js`), `full` (hats, noise and bass together), the `chroma` of each bar and how far it moved from the bars before (`harm`), `nov` (the last two bars against the eight before, over how much bars usually differ: something new) and `loop` (bars in a row like the bar four or eight before).
- **Events:** `brk` (the bass well under its loudest for `brkSecs`: a breakdown; a flicker of bass mid-breakdown doesn't end it), `drops` (the bass back past `dropAbove` for `dropHold`: the drop), and `events` (the hats in or out, past a margin, after `eventGap` steady seconds, or a breakdown starting).
- **What Journey does with it:**
  - the fingerprint (`FEATS`) gains `hat` (weighted most: the clearest sign of a new part in this music) and `noise`;
  - the novelty that starts a section adds a new bar (`nov`, `novWeight`) and, for `eventSecs`, an event (`eventNov`: enough to start one on its own);
  - a drop fires when the bass comes back after a breakdown (`L.drops`), as well as on a jump in loudness;
  - the tension adds how full the texture is (`fullWeight`), beside loudness;
  - a loop that's run `loopBars` unchanged brings the progression's next step sooner;
  - with no clear dance pulse (`G.acConf`, eased into `J.beatClear`), the pace is calmer (`unclearCalm`).
- **Signals on the bus:** Hi-hats, Noisy against tonal, Fullness, Stereo width, The notes change, Something new (so movers, scene drives and each layer's "follows" can use them).
- **Narration:** the panel's "Hearing:" line (`#jHear`): the hats in or out, the bass (or a breakdown), noisy or tonal, the filter, wide, the loop's length, something new, the notes moving.
- **On the user's tracks** (offline, `tools/track-run.mjs`, which now feeds the unclipped spectrum and the width, and records `L` each second): Mutant Pulse's new sections fall where the hats go in and out and at the breakdown, and it drops as the bass comes back; Us and Them (a real recording, not techno) gets its choruses as one section that returns each time, calm pace (264 s floating, none frantic; it was 102 s frantic), and the band coming in after the organ intro as its drop.

## Looking ahead: the beat map and the drops, read before the track plays

The user asked for Journey to read the MP3 before it plays and decide ahead. `audio/foresee.js` (a leaf module; what it finds is in `F`) reads a dropped-in track the moment it's decoded (`foresee(buffer)`, from `loadTrack` in `player.js`, in pieces between frames, a second or two for a long track), and the player toasts what it found ("Read ahead: 2 drops at 1:32, 3:10").
- **What it finds:** the low end's loudness (20-150 Hz, two low-pass stages, in dB) every 10 ms, run through the live listening's own rules (`TUNE.listen`: the bass well under its loudest for `brkSecs` is a breakdown, its return the drop), each drop timed from the sharpest rise (the first kick back), not from when the rule is sure; and the low end *arriving* (`jumpDb` above the 8 s before: the kick coming in after a beatless intro, a band after an organ). `findDrops(env, dt)` is the pure part.
- **Where the track is:** `F.at()` (set by the player): the track's time as heard, as the frame will reach the screen, by the Sync slider (like the beat grid's `G.lead`). Tests and the track tool set their own.
- **What Journey does** (`foreStep` in `director.js`, `TUNE.foresee`): before each known drop (drops within `gap` s of the one before are left to the live rules) a run-up of `leadBars` bars (never longer than the breakdown, at least `minSecs`), `J.anticip` 0..1:
  - the tension is lifted towards `tension` (so the city's lights climb, the fractal falls faster, the orbits tighten, the stargate quickens), and the cosmos camera builds towards a planet (`C.build`);
  - the trails zoom and turn faster (`zoom`, `spin`);
  - in the last `hushBeats` beat the picture holds its breath (`J.hush`, `P.hush`: darker, most at the edges, in the finish in both renderers), so the drop lands harder;
  - no new section and no progression step in the last `holdBars` (`J.foreHold`): a change that comes then waits and starts with the drop;
  - the drop fires on the moment it's heard (`dropFX`, a cut), and the live detection stands down (its 15 s gap).
- **On the user's tracks** (`tools/track-run.mjs` reads ahead too and reports it): Mutant Pulse's drop at 2:29.0 lands on the moment, where the live listening heard it at 2:32; Evolving Groove's kick returning (0:30, 2:57), Hypnotic Groove's bass cuts, and Us and Them's band coming in (0:35) are found.
- **Narration:** the "Hearing:" line adds "Read ahead: the drop in 4 bars, building to it". The bus has "The drop is coming" (`SIG.coming`) for movers.
- **The beat map** (`beatMap()`, `F.map`; the user asked for the pre-read to help keep time, and for anything else that would): the grid is locked from the first beat instead of after a few seconds of listening, keeps exact time through breakdowns, and knows the 1 and the phrases.
  - **The tempo** from the whole track at once: the onsets' autocorrelation (the low end's energy rises, and a little of the rest's) for a rough tempo, then the period at which every onset lines up best (a phase fit over all of them, steps of 2e-5 of a beat), and where the beats fall. How well they line up (`conf`) decides whether there's a steady beat to map at all (`TUNE.foresee.map.sure`): a band playing freely (Us and Them) isn't mapped, and the live grid listens as before.
  - **Each beat** is nudged to where the kicks near it fall (a slow drift, within `drift`), then all moved to the kicks' attacks: a kick's low end swells a few milliseconds after its click, so the low end alone put beats ~16 ms late (`attack`).
  - **How hard the kick is on each beat** (`kick`): the pulse is that hard (`softPulse` where there's none: a breakdown).
  - **The 1:** changes land on it (a new part, a breakdown, the drops, `dropW`), and claps fall on 2 and 4 (`clapW`). **Phrases:** which bar of every four starts one, the same way. **Changes:** on phrase lines, the four bars after unlike the four before (`change`, in the bars' usual spread).
  - **The grid runs from it** (`mapFrame` in `beatgrid.js`, `G.map`): each beat ticks when the track as heard reaches it (half a frame early), with its place in the bar; the bars are counted as the map counts them, and phrases (`J.mapPhrase`, `newSection`) fall on its phrase lines. A seek or pause picks up at the right beat with no burst. The live kicks aren't needed while it runs.
  - **Sections on the track's changes:** a change one beat off arms a new section, which starts on its downbeat; live novelty within `coverBars` of a known change waits for it.
  - **On the user's tracks** (offline, `tools/track-run.mjs`): the grid locked for 272 of 272 s on Evolving Groove (the live grid: 207) and 202 of 203 on Mutant Pulse (live: 180). Evolving Groove 130.04 BPM, Hypnotic Groove 122.19, Mutant Pulse 128.03 (its rolling bassline lowers the fit to .14: still mapped), Us and Them not mapped (.02). On the synthetic test track every beat is within 3.5 ms, through its breakdown too.
- **Where the track is at the speakers** (`heard()` in `player.js`): the audio clock's own output timestamp (`getOutputTimestamp`: smooth between the audio clock's steps, and counting the output's delay), or the clock less the reported output delay.
- **The track waits to be read** (`waitMs`, "Reading ahead…"): a second or so, so the beat is locked from the first kick; a slow device starts anyway. The toast says what was found ("Read ahead: 130.0 BPM, 2 drops at 0:29, 2:56").
- **Tap to sync** (the panel, under Sync: "Tap on the kick", `TUNE.sync.taps`): eight taps on the kick as it's heard, each against the map's nearest beat (looked for around `tapMid` of delay, allowing `tapLead` for tapping early); the middle of them is how far the speakers are behind what the browser says (Bluetooth), and becomes the Sync setting (now -200 to +400 ms).
- **Only for tracks:** a video's sound, the camera and the built-in beat have nothing to read ahead; the grid listens and Journey reacts live as before.

## DJ mode: two decks and a mixer under the picture

The user asked to mix two tracks like a DJ, with the visualiser following the set; first a panel under the picture, for the mouse, to try how it feels (how to control it is for later). `audio/dj.js` (the engine, `DJ`) and `ui/dj.js` (the panel), tuning in `TUNE.dj`.
- **The panel** opens and collapses from the bar's **DJ** button (or its ▾ Hide). While it's open the picture is drawn that much shorter: `S.djH` is the panel's height (`panelH`, at most `maxShare` of the window), `viewH()` and `viewAsp()` in `state.js` are the picture's height and aspect (every visual that read `innerWidth/innerHeight` reads `viewAsp()`; the renderer sizes itself by `viewH()`), and the CSS moves the bar, the caption and the key strip up by `--djH`. Closed, it's exactly as before.
- **A deck:** load (Load, the playlist, or drop a track on it), play/pause, Cue (always back to the cue point, stopped: it used to set the cue when pressed while stopped, as a club player's does, which with a mouse moved it by surprise and the user found it erratic), Set cue (the cue point here, on the nearest beat; a track is cued on its first 1), loops of 1, 2, 4, 8 or 16 beats (`djLoop`: from the beat it's on; the source loops it itself, seamlessly, and `pos()` follows it round; the same length again leaves it, playing on; another changes its length; moving out of it leaves it; shaded on both waveforms), nudge − + (held: `bend` slower or faster), tempo (±`tempoRange`, double-click resets), Sync. Its close waveform scrolls past the playhead in the middle (`zoomSecs`), with the beats, bars and phrase lines from its beat map and its drops in red; the overview below shows the whole track (click or drag to move through it). The head shows its BPM as playing, where it is in the bar (four squares), the time, and "visuals follow" on the lead deck.
- **Each deck's own read-ahead:** `readAhead(buffer)` in `foresee.js` reads a track (its beat map, breakdowns and drops) into its own result, leaving `F` alone (`foresee()` uses it for the player).
- **The mixer:** per deck a three-band EQ (`eqLow`, `eqMid`, `eqHigh`; `eqMin` is a kill), a filter knob (left a low-pass closing to `filterLo`, right a high-pass opening to `filterHi`, centre off) and a channel fader; a crossfader (each side full up to the middle, then easing out: `xfGain`); then a limiter (two loud tracks don't clip) into the analyser, so the visualiser follows the mix. Knobs: drag up or down, the wheel, double-click resets; their neutral setting sits at twelve o'clock.
- **Sync** (`djSync`): the deck's tempo to the other's (from the two beat maps), and with both playing its bars lined up with the other's; started while the other plays, it starts on the other's next 1 from its own nearest 1, scheduled on the audio clock. It then follows the other's tempo, and `djFrame` nudges it back into phase when it drifts (`lock`, at most `lockMax`). Syncing one deck unsyncs the other. Moving its tempo slider unsyncs it.
- **The visuals follow the lead deck** (`djFrame`, each frame from `main.js`): the deck the faders favour (channel fader × crossfader, with a little hysteresis) gives the beat grid its beat map, breakdowns and drops (`F.map`, `F.drops`, …), and `F.at` its time as heard (as the player's, by the Sync slider). `F.rate` is its tempo, so the grid's beat period follows it (`mapFrame` in `beatgrid.js`). A deck starting stops the main player.
- **Not yet:** headphone cueing, key lock (tempo changes shift pitch, like vinyl), hot cues, a MIDI controller, recording the set, Journey treating a mix as a transition or the mixer's moves as signals, auto-mix.

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

## The city

`visuals/worlds/city.js`, rebuilt after the user found the old skyline "naff" (flat rectangles, noisy windows, no depth), and again as a stylised poster (`docs/taste.md`, principle 8) after they found its bouncing "annoying":
- **Four rows**, far to near (`row()`, and the same numbers in the shader): the far rows are the tall towers downtown, pale in the haze; the near rows darker and shorter. They scroll at different speeds.
- **Silhouettes:** gaps between buildings, a narrower crown on some (setbacks), antennas on others, whose red lights blink on the beat.
- **Light and shadow:** each block's side facing the moon is lit, its edge catching the light, and each row casts its shadow onto the row behind, away from the moon.
- **A district per section** (`sectionLayout` in `util.js`, `TUNE.city.riseSecs`): a new section's buildings rise as the old ones sink, in a wave; a returning section brings its skyline back. Every building's random numbers are keyed by its district.
- **Movement:** each building breathes only a little with its part of the spectrum (`TUNE.city.breathe`; it was five times as much), and the skyline leaps on a drop (`jump`).
- **Lights follow the build** (`J.tension`, eased by `lightEase`): windows light floor by floor from the street up, in each building's own style, with a share changing on the downbeat (`uCitySeed`); neon signs on many buildings in the nearer rows switch on one by one, in the palette's colours, and flicker on stabs.
- **Sky:** a glowing dusk (hot at the horizon, deep night above), long clouds lit from below, a glow in the haze where the light comes from (the moon is gone), and two searchlights swinging to a new angle each bar (`sweepBars`).
- **Street:** the skyline reflected and rippling, and traffic: headlights one way, tail lights the other, with streaks on the wet road.
- **Front plane:** the two nearest rows, so things "between" sit behind the near buildings and in front of the towers.
- Simple mode draws the same rows, lit sides, shadows, windows, neon, searchlights, antenna lights and traffic, plainer.

## The other worlds

- **Landscape:** three ranges shaped by the song's loudness history (Journey's energy), nearer ones darker and far ones fading into the sky, with rock striations, slopes facing the sun lit, mist on the water and glints under the sun.
- **Space:** stars rushing past, two clouds of gas, and a ringed planet: the rings are banded with a dark division, and the planet's shadow falls across them; two moons step round every other beat.
- **Aurora:** curtains with rays near their foot, swelling with the melody, over a treeline and a still lake that mirrors them.
- **The painted worlds** below were redone as stylised posters (`docs/taste.md`, principle 8): a bright sky behind crisp silhouettes stepping from pale far off to black near, one big light, and the music moving the whole scene. Each re-forms per section (`sectionLayout` in `util.js`; a returning section brings its own back), and flares on a drop (`J.drops`). Tuning in `TUNE.dunes`, `forest`, `sea`, `deep`.
- **The paper worlds** (the sea, the reef, the forest), rebuilt after the user found the posters "flat, 2D-ish" and their moons naff: layered cut paper with real depth. What makes them read as paper, not flat: each layer casts a soft shadow on the one behind (the next layer's coverage tested a little up and across), its upper edge catches the light, its face is shaded, far layers fade into the air, and the paper's fibres (`paper()`, with `vnz()` value noise, shared in the segment prelude of `compose.js`). Each section brings its own palette (hand-picked, blended over `morphSecs`) and its own shapes, grown out of the old ones. Hooks for looking at one: `seaForce(D, great?)`, `deepForce(D, ball?)`, `forestForce(D, gust?)`.
- **The paper sea** (`sea`): six layers of wave. A section's wave family blends swells, Hokusai's curling crests, chop and seigaiha scallops, cut clean or torn, with inner cut lines or none; palettes Hokusai (prussian blue and cream, a red sun), dusk, tropic, storm, gold, blush, midnight (stars), mint. Scalloped paper clouds, each section's own; a banded paper sun on the horizon in some palettes, sinking as the tension builds (`sunSink`), its light on the faces. The layers slide past each other and rock out of step, like a paper theatre's wave machine; the swell follows the bass, the crests flare on the kick, flecks sparkle with the hi-hats, and a drop sends a great wave (a crescent whose lip curls over, foam on its rim: `seaGreat`) across the front (`greatSecs`). Some seas have gulls, their wings beating, and a paper boat riding a wave. Front plane: the nearest wave.
- **The paper reef** (`deep`): five layers of reef drifting slowly past (`track`): rock mounds, ribbed sea fans, branching coral, vase sponges and swaying seaweed, in each section's own mix (`uDeepW`); palettes lagoon, abyss (the reef glows), golden shallows, kelp, twilight. A school of paper fish swims through the middle, turning every other bar, and on a drop gathers into a spinning bait ball (`ballSecs`). Jellyfish drift up and pulse on the kick; shafts of light slant down (brighter with the mids, flaring on a drop); bubbles rise livelier with the hi-hats; caustics on the far floor on the kick. Front plane: the nearest layer.
- **Dunes** (`dunes`): a synthwave desert. A huge sun banded gold to pink, cut by bands sliding down its lower half, its rays turning slowly on a violet-to-gold sky; four ridges of sand (sharp crests, a long slope on one side) stepping from pale far off to black near, the slopes facing the sun warmed, crests rimmed with hot light (brighter on the beat), ripples carved in the sand. The sun sinks towards the dunes through a build (`sunHigh`, `sink`) and flares on the drop; each section re-forms the ridges (nearest first); sand streams off the crests on the hi-hats. Front plane: the nearest ridge.
- **The paper forest** (`forest`): six layers of paper trees (pines of stacked triangles, round canopies, poplars, each section's own mix) that the camera tracks slowly through (`track`, near layers faster, quicker as the tension builds), bending with the bass and a breeze, whipped over by a drop's gust (`gust`). Each section is a season: autumn, dawn, winter (snow on the trees, snow falling), an enchanted night (fireflies blinking with the hi-hats), mist, sunset, blossom (petals falling); a low banded sun with rays fanning between the trees in some, no moon. Leaves, petals or snow drift down, more with the hi-hats. Front plane: the nearest layer.

## The 3D worlds: the Hollow, the Cathedral, the Vessel, the Geode and the Corridor

Ray-marched places the camera flies through for ever, like the cosmos (the user loves their depth: `docs/taste.md`).
- **The Hollow** (`worlds/hollow.js`, `TUNE.hollow`): a gyroid honeycomb cave (every section: the other labyrinths in `hwTp` broke into floating blobs, which the user found "an asteroid belt"), each section its own stuff (stone, faceted crystal, wet flesh breathing with the bass, ice) and hues. The route is stretches of different kinds (a wander, a corkscrew, swoops up and down, a slalom) blended into one another (`path()`, their kinds handed to the shader in `uHwK` so the carved tunnel and the camera always agree); the camera banks into the turns. Every `chamberBars` bars and at each new section, the tunnel opens into a chamber ahead: a vaulted hall ringed with pillars, lit by a glowing heart pulsing on the kick; the camera slows, turns to look at it and passes beside it (`hollowChamber()` opens one now, for tests).
- **The Cathedral** (`worlds/cathedral.js`, `TUNE.cathedral`): an endless hall church, columns in rows in every direction under pointed rib vaults, the same arches traced into the vaults at a third of the size, stained-glass oculi pulsing on the kick, light in the floor's lines; the camera flies the nave, rising into the vaults with a build, rolling on a drop; each section its own proportions and stone (warm stone, marble, obsidian edged in neon). Every `altarBars` bars and at each new section, an altar in a side aisle ahead, lit and hazed (`cathedralAltar()` sets one now).
- **The Vessel** (`worlds/vessel.js`, `TUNE.vessel`): a flight along an artery, inside the body: a winding tube, wet and ribbed, a network of veins glowing in its walls, side branches opening off it, red cells (biconcave discs) tumbling past with the flow (`vsCells`, a grid drifting a little faster than the camera). Each kick sends a wave of swelling down the walls and surges the flow (`push`); a drop floods it with light. Each section its own vessel: an artery, a vein, lymph, or a nerve (sparks running along it instead of cells). A centrepiece floats in the tube every `gate` units (`vesselAt(z)` for tests).
- **The Geode** (`worlds/geode.js`, `TUNE.geode`): a winding fissure through the rock, its walls carpeted with crystal points (hexagonal prisms ending in a point, one in each cell of a grid of angle round the route and distance along it, `gdMap`; a march never steps past its cell's edge, where the next crystal begins), opening every `GAP` units into a cavern where they grow huge. Each crystal is milky at its base and deep and glowing at its tip; the rock between is banded like agate. The crystals grow longer as the music builds (`growCalm` to `growHigh`), a wave of light runs through them on each kick, they glint with the hi-hats, a drop sends a white flash racing out through them from the camera and bursts the dust; the flight slows through a cavern (`cavitySlow`). Each section its own crystal: amethyst, citrine, quartz, emerald. A centrepiece stands in the middle of the cavern ahead (`geodeAt(z)` puts the camera somewhere, for tests). Simple mode draws the fissure's cross-sections as rings of crystal points.
- **The Corridor** (`worlds/corridor.js`, `TUNE.corridor`): an endless hall of neon frames in the dark over a black mirror floor that doubles them (one bounce: the hall marched again upside down, dimmer). No walls: each ray gathers the frames' glow as it passes them (`crGlow`), so it's cheap. Each kick sends a wave of light rushing away down the frames (`waveSpeed`), every fourth frame burns brighter, a build quickens the flight, a drop strobes the hall (`strobeHz`, halved with reduce motion through `dim`). Each section its own frame (square, arch, hexagon, ring) and width; the colours are the palette's. A centrepiece stands in the hall every `gate` units (`corridorAt(z)` for tests). Simple mode draws the outlines receding, mirrored in the floor.
- **Particles:** `motes()` in the segment shaders' prelude (`render/compose.js`): one mote per cell of a grid, found along the view ray up to the rock (walls hide those behind), soft, the near ones bigger, twinkling, drifting; the Hollow's spores rise through the lamp's light, the Cathedral's dust gathers in the oculi's shafts (`shaft`). Livelier with the hi-hats, bursting on a drop (`TUNE.hollow.motes`, `TUNE.cathedral.motes`); keep `sparkle` at most 1, or some motes subtract light (dark specks). Simple mode streams dots past (`motes2d`). The Geode has glittering dust (`TUNE.geode.motes`).
- **The layers on their walls:** a world drawn in the same pass as the main trails reads them (`HAS_MAIN`, `wallGlow()` in the prelude: the trails' picture tiled mirrored) and lays it on its walls, stuck to them (`wallGlow` in `TUNE.hollow`, `cathedral`, `geode`, `vessel`; the Corridor reflects it in its floor); WebGL only.
- **Objects inside them:** a chamber's heart, an altar, the Geode's caverns and a place in the Vessel and the Corridor are where the centrepiece stands (`P.anchor`, with its distance `dist`). While one stands there, `main.js` draws the scene `INSIDE` (the world, the trails, the objects, then the world's front plane), and the world's front plane is only as deep as the object (`uHwF`, `uCtF`, `uGdF`, `uVsF`, `uCrF`): the walls, pillars and columns nearer than it pass in front of it.

## The cosmos: space as a place the camera explores

A world that is a 3D place rather than a painted backdrop: generated star systems a camera flies through, with the track's shape leading. It's one of Journey's worlds. The staged plan and its log are in `docs/cosmos-plan.md`. It lives in `visuals/worlds/cosmos/`:
- **`system.js`: the places.** Star systems grow from an index (`makeSystem(idx)`, with its own seeded numbers, so a system is the same every visit and the page's random draws are untouched). The index says where a system sits:
  - **galaxy:** the track's, a hash of its name (`hashStr`), so the same track takes the same journey;
  - **arm:** its mood, cold, warm or hot (`armFor(T, pace)`);
  - **place:** how far along the arm it is.

  A system's heat comes from its arm:
  - cold systems have ice and ocean worlds and pale stars;
  - hot ones have lava, rock and bigger, deeper-coloured stars;
  - inside planets are hotter than outside ones.

  Each system has three to six planets, some with rings, and moons, which orbit in motion time. There's more to find:
  - **The star can be a set piece:** twin stars (warm and hot arms), a pulsar (warm and cold), or a black hole (hot).
  - **Planets carry life and weather:** cities on night sides, auroras at the poles, a great storm in a gas giant, clouds.
  - **Belts and built rings:** an asteroid belt in a gap between two planets, and sometimes a vast ring built round the star (`halo`).
  - **The monument** (`sys.mon`): where a centrepiece stands, in orbit round the first planet.

  `galPos(idx)` places each system on its arm's spiral, for the galaxy view.
- **`fly.js`: the camera and the music.** The camera (`scene/camera.js`, a leaf module meant for other worlds later) follows each shot's goal on critically damped springs, so any change of shot eases in and out. The shots are `orbit`, `approach`, `flyby`, `reveal` (the whole system), `eclipse` (the subject in front of the star), `drift`, `push` (a build), `belt` (through an asteroid belt, the rocks rushing past), `skim` (low over a solid world's surface, its horizon curving ahead) and `sunrise` (just above a planet's night side near the terminator, looking along its edge as the star rises over it). A shot can say which way is up (`up`): skim and sunrise use the planet's, so the horizon lies level. The camera is pushed out of any body it gets too near (for a skim or a sunrise, only just above the surface). The track's shape leads (`TUNE.cosmos`):
  - **A build:** the tension's quick average (`buildFast`) pulls ahead of its slow one (`buildSlow`). The camera is drawn toward the biggest world near by; how close it gets follows how far the build has got, not the clock. The view narrows and the stars start to stretch. A build that fades for `fizzleSecs` lets the camera go.
  - **The drop** (`J.lastDrop`) releases it: a hyperspace jump to the hot arm (`dropJump`, at most every `jumpGapSecs`), or a sudden pull back to the whole system with the view flung wide (`dropWiden`). The biggest drops, after a full build, go out to the **galaxy** (`galaxyChance`) or to a black hole. On the galaxy trip, the system falls away to a point on its arm; the camera takes in the whole spiral (three arms in the moods' colours, a bright core, where it's been and where it's going) for `galHoldSecs`, then dives to the next system's point and arrives there.
  - **The kaleidoscope** (`C.fold`, `TUNE.cosmos.fold`): some drops (`dropChance`) fold the view for `bars` bars, more ways the more intense the music (`n`), sometimes only in a circle round the subject (`localChance`, `localR` of its radii). The fold is applied to the view before the rays are traced (`czFoldSp`, in the world and its front plane alike), so it mirrors the space itself: wedges round the subject, with the star in the middle of the mirrored wedge so it repeats round the planet as a crown, turning slowly (`turn`). Part-way open it's a warp between the two. Simple mode draws the cosmos aside and lays it back as turned and mirrored wedges. The caption adds "folded six ways".
  - **The subject's layers** (`C.dress`, `TUNE.cosmos.dress`): some sections dress the planet being filmed (kept with the section, so it comes back the same): a wire cage of meridians and parallels just outside it (`czCage`, its far side faint like an x-ray), turning a notch each beat, with a band of light running down it each bar; and a ring of motes round it, flaring on stabs. A drop bursts the cage outwards before it re-forms. Simple mode draws the cage as ellipses and the motes as dots.
  - **The quiet:** no kick for `quietSecs` drifts or circles, slower. The kick coming back moves on at the next bar.
  - **A new section** goes to a system on the arm that suits it: another system, or sometimes another body when it's already on the right arm (`newSystem`). The first section owns where the camera already is. A returning section goes back to its system and body (remembered on the section type).
  - **Set pieces on the moments that matter:** a new section opens on an eclipse or a sunrise about `showpiece` of the time (kept with the section), and a drop goes straight to one about `dropShowpiece` of the time.
  - **Arriving at a set piece** (twin stars, a pulsar, a black hole), it circles it first.
  - **A centrepiece coming in** stands in the space as a vast monument, and the camera goes to circle it.
  - **Otherwise** a new shot every `shotBars` bars: calm music floats and circles, intense music swoops close (through the belt and skimming surfaces more when it's intense).
  - **A shot picked by hand** holds the camera for `handSecs`, so the music doesn't take it straight back.
  - The kick nudges the view in, harder in a build, and the pace sets how quickly the camera moves.
- **Landing** (`surface.js`, `TUNE.cosmos.land`): some sections (`chance`, kept with the section) land on one of the system's solid worlds; the lab's L lands on the world being filmed, T takes off, and `?lab=terrain` lands straight away.
  - **The way down:** the camera skims in low, and inside `enterR` radii the view goes through the clouds (a whiteout, `uSfHaze`, hides the switch from space to ground over `fadeSecs`) and comes out high over the ground, descending. Taking off, it climbs back into the cloud (`exitAlt`) and comes out just above the world, pulling back.
  - **The ground** (`czSurface`, ray-marched, the same height `sfH` in simple mode): ridged mountains stepped into strata (ledges and cliffs) on rocky and green worlds, smooth snow on ice worlds, basalt with lava glowing in the valleys and cracks on lava worlds, green land with the sea over the valleys on ocean worlds; snow high up; soft shadows from the sun; fading into the sky with distance, the ground curving away.
  - **The river valley** winds along `sfPath`, and its floor is flat by construction, so the camera flies it safely whatever the noise does; soaring (`soar`) is above every peak.
  - **The sky from below** (`sfSky`): its colour by the sun's height (blue by day, red at dusk, dark at night), the sun and its glow, clouds lit from below, stars at night, auroras over ice worlds at night, and at night on worlds with cities, districts of lights over the valley floor and lower slopes. Mist lies in the valleys, thickest at dawn and dusk. So the old painted worlds live on as places: the landscape's ranges and mist, the aurora over ice worlds (mirrored in the sea on ocean worlds), the city's lights. The sun's height follows the music (`sunLow` calm to `sunHigh` intense, over `sunSecs`), standing a little off the way ahead (`sunAz`).
  - **The music:** it flies the valley (`valley`), a build climbs to soar over the peaks, a drop dives back into the valley and races along it (held for `diveSecs`), the kick nudges the view. While landed, the space camera's shots, builds and jumps wait; a section that goes to another system takes off first, then jumps. The trails centre on the sun while it's in view. Its caption: "Low along a valley of …", "Soaring over the peaks of …".
  - **Simple mode:** the sky by the sun's height, the sun, stars, and six ridges of the same ground as silhouettes far to near, darker near and fading into the sky far off; the sea, lava's glow and cities' lights.
- **The layers join the space.** The camera's movement (`motion`: how the far view slides, and how fast the camera closes in) goes into the shared context (`CTX.fly`). It becomes wind (`TUNE.ctx.flyWind`), so the comets, flow and trails slide with the view, and trail zoom (`flyZoom`), so the glow streams outwards as the camera flies in. The star is the world's `light`, so objects are lit from where it is on screen. A world's `motion` and `light` are set in its `params` while it's on screen.
- **Orbits** (`layers/orbit.js`, a Journey layer, best over a world): ten flares on tilted orbits round the world's subject (`P.focus`: the planet being filmed, space's planet, or else the trails' centre), leaving rings and spirals in the trails. They pass behind the planet, tighten and quicken as the tension builds, and a drop flings them wide before they settle back.
- **Its front plane is the planets' discs** (`czFront`; in simple mode, their circles), not the star. So `between` sends the glow behind the planets, `split` puts the accent behind them, and `held` shows the glow only inside them. Its subject is the world's `focus`, so the glow centres on the planet being filmed.
- **A place can hold the centrepiece** (`P.anchor`, set by a world's `params`: where on screen, how big, or hidden behind the camera). The mesh objects use it instead of their usual place, so in the cosmos the skull (or any object) is a monument the camera can circle.
- **Drawing.**
  - **WebGL** (`look.js`): each pixel's ray is tested against the star and the six bodies that look biggest.
    - **Surfaces:** rock, banded gas, cracked ice, ocean worlds catching the star's glint, or lava glowing through its cracks (flaring on stabs). They're lit from the star and gain detail up close. Solid worlds have relief: ground rising towards the star is lit, ground falling away shaded (`czSpin` follows the light across the turning surface).
    - **Atmospheres** (`czAtmo`, added after the user found the surfaces "kind of flat"): a shell round each planet (not moons), its thickness, hue and density per kind in `TUNE.cosmos.atmo`. Seven samples along the view through it gather the star's light, carried a little past the terminator and reddening there like a sunset, brightest looking towards the star; it hazes the ground, sky or star behind it. It's thickest at the limb, where the view grazes the most air, and skimming low the camera is inside it, under a sky.
    - **What lives there:** cities on night sides (sprawls of lights, finer up close, glowing as a whole from afar), auroras round the poles (on the kick), a great storm in a gas giant with lightning on the hi-hats, clouds drifting over the ground, each casting its shadow on the side away from the star.
    - **Rings** have bands, a gap and the planet's shadow.
    - **The star's glow** shows round anything in front of it.
    - **A pulsar's beams** sweep round once a beat, flashing when they face the camera.
    - **A black hole** bends the light from behind it: the sky is looked up along a bent ray. It has a shadow, a bright ring at its edge, and a disk with Doppler brightening, whose far side's image is bent up over the top.
    - **Twin stars** are drawn, and both glow.
    - **The belt:** up close, the ray steps through a grid of cells (up to 28), each of which may hold an asteroid. Each rock has its own size (mostly small, a few big boulders), stretch and tumble, and a lumpy, cratered surface (`czRockD`). It's marched only where the ray meets its bounds, so any number costs the same. The belt lies in gas and dust (`czGas`): ten samples along the view where it passes through the belt's thick ring, lit by the star (brighter looking toward it), with wisps streaming away from the star like outgassing tails. From afar it's a soft band of dust streaked along the ring, lit towards the star, with rocks catching the light at fixed places; they fade out with distance before they'd shrink below a pixel (the old speckle shimmered like static).
    - **The built ring:** a cylinder band round the star, its inner face lit, with seams, windows, and a pulse running round on the beat.
    - **Far off:** gas clouds and stars, which streak in a jump and start to in a build.
    - **The galaxy** (`czGalaxy`) is mixed in by `uGal`.
  - **Simple mode** (`draw2d.js`): the same, plainer.
    - Bodies are shaded discs, far to near, with rings split behind and in front. Planets have an atmosphere (haze thickening to the limb, and a glow round it, brightest facing the star), and clouds with their shadows.
    - A hole is a shadow, a ring and a split disk; a pulsar has beam lines; there are twin discs.
    - The built ring is its edges and a pulse line.
    - The belt is a pool of jagged, tumbling rocks and puffs of gas that follow the camera, and from afar bands of gas along its ring with glints at fixed places round it.
    - Oceans, storms, city lights and auroras are drawn.
    - The galaxy is 1,400 points on its arms.

  It costs the same however big the universe is.
- **Narration.** A world with a `caption()` (the cosmos: "Approaching a ringed gas giant", "Drawn towards a lava world", "Arriving at a hot star: …") shows it at the bottom left (`ui/caption.js`) while the world is on screen. The panel says how the camera follows the track.
- **To look at it alone:** the "Cosmos" preset, or Solo on its slider. The camera still flies with the music without Journey.
- **The lab** (`lab/cosmos.js`, `?lab=cosmos`, or the panel's switch, which lasts for the tab: `sessionStorage`) holds the cosmos on screen in Journey, and no other world, with Journey's layers over it (`J.worldHold`, which Journey's director reads; media still wins). It was once remembered for good, and held Journey in the cosmos visit after visit: the user found Journey "always stays within the cosmos". The panel says when it's holding. To keep the cosmos a while, pin it (W then its number while Journey runs).
- **Keys fly it by hand** whenever the cosmos is on screen, in the keyboard's **C** group (C, then the key: `ui/fly.js`; each holds the camera a while):
  - 1–7 pick shots (7 is the belt), S skims, U watches a sunrise;
  - J jumps, 8 goes to a black hole, 9 to a pulsar, 0 to twin stars (`visit(kind)` finds the next such system on the track's galaxy);
  - B goes to the next system with an asteroid belt (unless this one has one) and flies through it;
  - K folds the view: the whole view, then only round the subject, then back to the music's;
  - W dresses the subject: a wire cage, the cage and motes, the motes, then back to the music's;
  - L lands on the world being filmed (or the biggest solid one), T takes off;
  - G goes out to the galaxy.

## Meshes: the wire skull, the unicorn, the maths shapes and Blender models

**The mesh engine** (`src/render/mesh.js`, a leaf module) draws any triangle mesh as glowing wire edges over dark glass panes.
- **Data.** A mesh is `{pieces: [{pos, tri, part, hinge?, morph?}], hinge}`. `panesOf()` turns it into panes, each with its corners, centre, normal, part, piece and a fixed random seed; with a `morph` (each vertex's move to another pose: a Blender shape key), also how its corners, centre and normal move there.
- **Per-pane motion.** It's worked out in the vertex shader, and again in JavaScript for simple mode:
  - a hinged piece rotates about `hinge` (the jaw);
  - the dance's roll (`U.roll`), squash and stretch (`U.sq`) and one part lifting off whole (`U.lift`, `U.liftPart`);
  - its **style** (`U.style`, the `objStyle` setting: 0 glass wire, 1 solid, 2 outline, 3 hologram, 4 points, detailed below);
  - a morph is played by a weight (`U.morph`, -1..1, the pose both ways: the manta's wingbeat);
  - panes fly out along their normals, spinning about their own centres (`ex`);
  - panes vanish by seed (`gone`);
  - a band of light runs down the object (`sweep`);
  - random panes flash (`spark`).
- **WebGL drawing.**
  - Edges are drawn as screen-space bands, because WebGL lines are only 1 px wide.
  - On screen it's three passes: the far side's edges faintly (`xray`), then the panes (depth-tested, darkening what's behind them), then the near edges.
  - Into the trails it draws edges only (`trail`). The trail buffers have no depth.
- **Simple mode.** The glass is painted back to front, one fill per near pane (dark glass, its glow and the world's light in one colour); then the edges are gathered by colour into a few paths and stroked, the far side's dimmer, like WebGL's x-ray. The projection is plain arithmetic, done once a frame and shared by a mask and the drawing.
- **Styles** (`objStyle`, in the settings' "Objects" group, O then Y by hand):
  - **glass wire:** as above;
  - **solid:** lit facets, with faint edges;
  - **outline:** a black silhouette whose rim glows where the surface turns away;
  - **hologram:** see-through and tinted, bright edges with the far side showing, scan lines, few ghosts;
  - **points:** each pane shrunk to a glowing dot, which leaves dots in the trails.

  Journey picks one per centrepiece (`chooseStyle` in `cast.js`, weighted calm to intense by `TUNE.objStyles`: glass and holograms for calm, solid, outlines and points for intense) and remembers it with the section's cast. Simple mode draws them all, plainer (no scan lines).
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

**Blender models** (the `blender-object` skill). Blender runs in the container as the `bpy` package from PyPI, in a venv in the scratchpad.
- **Modelling:** a script in `tools/blender/` models the object and exports a `.glb`. It builds the object in Blender's own orientation (Z up, facing the front view), so a model the user makes by hand comes through the same way.
- **Parts and poses:** each material is a part, numbered by the digits its name starts with (`3_belly`). One shape key becomes the morph.
- **Importing:** `tools/import-glb.mjs model.glb name [--panes N] [--size .6] [--morph Key]` reads any glTF binary into `meshes/<name>.js`. It applies the nodes' transforms, reads sparse shape keys, welds the corners the exporter split, centres and scales the model, and with `--panes` simplifies each part.
- **The manta ray** (`tools/blender/manta.py`, `objects/manta.js`), the first:
  - a flattened wing section swept across the span, curled cephalic fins, a long tail and eyes, 954 panes;
  - parts: 1 back, 2 wings, 3 belly, 4 cephalic fins, 5 tail, 6 gill slits, 7 eyes (dark, glowing on the downbeat);
  - one shape key, "Flap" (the wings raised).
- **The manta's motion:** it glides rather than spins, through `meshObject`'s `motion` hook. It's tipped towards us (`TUNE.manta.pitch`), centred, turning only slightly and slowly (`turn`). Its wings beat in step with the bar (`SIG.barPhase`, one beat every `beatsPerFlap` beats), further as the tension rises (`flap`). Its dance comes slowly towards us and back, or tips it back to show its belly (it used to bank and bob: the user found it "janky").

**Lit objects** (`src/render/lit.js`, a leaf module; each made by `litObject()` in `objects/lit-object.js`): a model sculpted and baked in Blender and drawn solid, like a game character, under moving lights. The user asked how lifelike a Blender asset could get, to see them lit from different angles with shadows, and for stylised versions too. Four so far, each with its own preset and a slider under "Media and objects":
- **the goblin, lit** (`goblinLit`, `tools/blender/goblin_hd.py`): snarls with the music (the sculpt's shape key), ears glowing red when backlit;
- **the tentacle** (`tentacle`, `tentacle.py`): an octopus's arm, two rows of cupped suckers, its tip coiled; it writhes (a wave up it, the bass swelling it, kicks flexing it, a drop curling it), bent at nine joints (`bend`);
- **the hand** (`hand`, `hand.py`): a right hand, back to us, built round a skeleton (bones by forward kinematics, knuckles, tendons, veins, nails as their own glossy pieces); its shape key clenches it (every point of skin following its bone), gripping on the kick and flung open on a drop;
- **the heart** (`heart`, `heart.py`): ventricles, atria and their auricles, the aorta arching with its branches, the pulmonary trunk, the vena cava, coronary vessels laid onto the surface, fat in the grooves; it beats on every beat (its shape key squeezes it, then it fills).

How they're made:
- **The kit** (`tools/blender/lit_kit.py`; the goblin came first and keeps its own copy): sculpting in distance fields (`Grid`: the whole shape, then local features such as suckers only inside their own box), marching cubes (scikit-image), detail pushed along the normals, organic materials (`organic()`: mottled, spotted, darker in the creases, masked colours, subsurface, pores and wrinkles as bump), a studio and a camera, and the modes: `still` (Cycles, `--morph`, `--look marble`), `bake`, `blend`. Sculpts are cached beside the output (`--remesh`). Each asset's script is its sculpt, its masks and its shape key.
- **The bake:** a low mesh (~36–47k triangles, one texture atlas) baked from the sculpt: colour, an object-space normal map (in Blender's axes, z up: the shader turns it), ambient occlusion (multiplied into the colour) and emission; each corner's thickness (for light through thin parts), part and shape-key move; and a ~3k-triangle mesh with baked corner colours for simple mode. `tools/blender/lit_export.py <dir> src/visuals/objects/meshes/<name>-lit.js` packs it (16-bit arrays in base64, WebP textures; `--thin-x .36` for the goblin, whose lips and lids are thin but shouldn't glow): a generated module, not edited by hand.
- **Drawing** (WebGL): per pixel, three point lights (`U.lights`), wrap diffuse and a highlight per part (1 organic, 2 hard and glossy, 3 wet eyes, 4 metal), light through the thin parts from behind, and the first light's shadow (a 1024² depth map from the light, packed into RGBA, nine taps). It shares render/mesh.js's camera, so masks, scenes and the cosmos's monument work as for the wire objects. Textures start decoding when the module loads. Objects leave no ghosts in the trails (`TUNE.lit.trail` 0). Simple mode draws the small mesh flat-lit by the same lights, without shadows.
- **The spine** (`bend: true`): nine joints evenly up the model's height, each at the middle of its slice, each turning what's above it (`U.bend`: angles about z and x), blended across the joint, in both renderers; the normals turn with it.
- **Looks** (the **Lit look** setting `litLook`, last in the settings; the Asset Viewer's buttons): 0 real; 1 toon (its colours flatter and brighter in two bands of light, hard highlights, inked where it turns away); 2 neon (black, contour lines up it and a thin rim in the palette's colours, brighter where the lights fall); 3 chrome (a studio reflected in it: dark floor, a coloured horizon, a bright sky, the lights as strips; the normals read blurred, since skin's bumps scatter a mirror); 4 marble (veined white stone). Neon and chrome cast no shadow. Simple mode has plainer versions of each.
- **The rig** (`TUNE.lit`; each object's turn, size and own motion in `TUNE[key]`): a warm key light swinging round over the phrase and changing height each bar (stabs flash it), a rim light in the palette's second colour from behind, a kick light from below in the third; a drop spins them round it and the camera lunges in, a build pushes in, a breakdown leaves the key alone. `breakApart()` startles it (a whip round and a flash) instead of shattering.
- **Journey** casts them as centrepieces like the wire objects (`TUNE.lit.journey`: a little less often), each with a look it picks (`TUNE.lit.looks`, neon the most) and remembers with the section's cast (`J.litLook`); pinning one (O, then its number, while Journey runs) makes it every section's centrepiece.
- **Cost:** one draw of ~36–47k triangles and a shadow pass: much cheaper than the cosmos's ray marching. Each module is about 2–2.5 MB (2048² WebP textures), so the published page carries about 2 MB per lit asset (the limit is 16 MB).

**The maths shapes** (`meshes/maths.js`) are worked out when the page loads, not generated:
- a geodesic sphere (320 panes);
- a torus (768);
- a (2,3) torus knot (1,680);
- a dodecahedron (60);
- a spiky star (60, key `spikes`, because `star` is the star-flash hit).

Every pane faces away from its own inside point: the centre, or for the tube shapes the tube's centre. Parts band the panes into six colours.

**Every mesh object** is made by `meshObject({key, label, words, mesh, motion?})` in `objects/mesh-object.js` (`motion(U, P, x)` changes the frame's settings: its own way of moving). `skull.js`, `unicorn.js` and `manta.js` are one call each, and `objects/maths.js` makes all five maths shapes (the registry spreads its array). To add a shape, make a mesh and add a `meshObject` call. Then give it a line in `TUNE` (`chance`, `size`, `hinge`) and a registry entry.

**What every mesh object does** (the skull's behaviour, now shared):
- **Music:**
  - it dances (see Dance), over a slow turn at motion time (`spin`);
  - its hinged piece (the jaw, the head) sings with the mids (and still dips a little on the pulse);
  - a band of light runs down it each downbeat;
  - a scatter of panes flashes on stabs, and the parts' colours move round the wheel.
- **Arriving and leaving.** It arrives by assembling out of flying panes. When it leaves, its panes wink out.
- **Shattering.** It shatters on a drop (every 16 bars when playing by hand), then pulls back together over `explodeSecs`; the rest of the time it dances. `breakApart()` does it on demand.
- **Journey.** Any object can be a section's optional **centrepiece** (`J.centre`, chosen in `recast` and remembered with the cast):
  - the lead steps back to 70%;
  - there's never a lens over it;
  - the mirror tunnel wins while media is loaded.

  A centrepiece comes in about `TUNE.scene.centreChance` of sections, and the section's scene template decides how it relates to the rest (among the world's planes, holding a fill, masking the trails). `?lab=skull` gives the skull .5 of sections instead; `?lab=objects` gives every object an equal share of about half.
- **Manual:** the "Skull", "Unicorn", "Manta" (underwater) and "Torus knot" presets (`journey:false`). Every object also has a slider under "Media and objects".

## Scenes: composing the pictures

The first-principles model (the rebuild is logged in `docs/composition-plan.md`) is three kinds of thing plus one rule:
- **signals:** anything that changes over time (`scene/signals.js`);
- **images:** every visual is a picture with coverage: worlds (with a front plane), trail groups, hits, objects;
- **operators:** trails, the kaleidoscope, masks, fills, and a weight that follows a signal;
- **the rule:** a **scene** is a stack of images in any order, in which one image can fill, mask or sit between others.

**The signal bus** (`src/scene/signals.js`, a leaf module) holds `SIG`, fed once a frame by `main.js` (`updateSignals`).
- **Signals:** the band followers, the pulse, every kick, stabs, loudness, the beat and bar ramps, energy (tension) and a section-change swell.
- **Readers:** movers (`sig(key, react)`, every slider's dropdown lists the bus), and scene entries' `drive`.
- **Adding a signal:** add it to `SIG`, feed it in `updateSignals`, and give it a line in `SIGNALS`.

**Scenes** (`src/scene/graph.js`) are plain data, a stack bottom to top. `resolveScene()` compiles one into a draw plan (`P.sc`), cached per scene object, so a scene is never edited in place: a change is a new array.
- `{world: 'all'}`: every world on screen, whole. `{world: 'front'}`: the worlds' **front planes** (the city's two nearest rows of buildings, the land's nearest ridge, the aurora's treeline, space's planet, the cosmos's planets) repainted over what's below, so what's below sits *between* the world's planes. A world's `front` has `glsl` (a coverage function `fn(sp)`) and `path2d` (its outline for simple mode).
- `{trails: 'main'}`: the trail group holding every layer no other group claims. `{trails: 'back', layers: ['comets']}`: another group (at most `TUNE.scene.maxGroups`, each a full-size feedback pass). So comets can fly behind the buildings while the ring pulses in front.
- `fit: true` on a trails entry: the group's picture shrunk round the world's focus, its centre landing on the subject (`P.fit`: where, and by how much, from the subject's radius and `TUNE.scene.fitSpan`). With a mask to the world's front, the glow is held inside the planet.
- `mask: {object: 'skull', keep: 'inside' | 'outside'}` or `{world: 'front', keep}` on a trails entry: shown only inside (outside) that shape. It applies only while the object is on screen.
- `{hits: true}`, `{objects: true}` (every object on screen that no entry places), `{object: 'skull', fill?}` (one object, here in the stack: among a world's planes, under the hits, anywhere).
- **Fills**: an object's glass shows another image: `{layers: [...], fold, zoom?}` (those layers alone, any layer, the media tunnel too), `{trails: 'inner', layers: [...]}` (a group seen only through the glass, shrunk in), `{world: true}` (the worlds shrunk in, brightened), and `part: 7` limits it to one part (the eyes). Tuning: `TUNE.scene` (`fillAmt`, `fillGain`, `fillZoom`, `worldFillZoom`, `worldFillGain`, `partFillAmt`).
- `drive: {src: 'kick', amt: .7}` on a world or trails entry: its weight follows a signal.
- **Cost.** A fill is one half-size pass, a mask one small pass, a second trail group one full pass, and an object between two segments one extra full pass. "Between" costs nothing.

**The shared context** (`src/scene/context.js`, a leaf module) is what makes the visuals feel like one piece. `main.js` updates it once a frame (`updateContext`):
- **one palette:** three hues (offsets from the running hue). Each section picks one (`TUNE.palettes`, `paletteWeights`: triad, analogous, split, contrast); manual mode uses the triad. Comets, ribbons, shockwaves, the star, sparkles, the outline and the objects' parts take their hues from it (`P.pal`, `uPal`), rather than each inventing its own. The panel narrates it.
- **one wind:** it turns slowly, blows harder on bass swells, and gusts on section changes and drops. It carries the comets and the flow, speeds the ribbons, sways the objects and streams the trails downwind (`P.drift`, `uDrift`). Tuning: `TUNE.ctx`.
- **one light:** each world has a `light` (hue offset, saturation, direction): the city's windows from below, the low sun, the aurora's green from above, pale starlight. The objects' glass and edges catch it on the side facing it.
- **one focus:** a world can say where its subject is on screen (`focus`, set in its `params`; the cosmos: the planet or star it's filming). The trails' centre (`P.cx`, `P.cy`: where they zoom, spin and fold, and where the ring, burst and shockwaves sit) moves there (`TUNE.ctx.focus`), easing across (`focusEase`) as the camera moves or the subject changes. So the glow belongs to the place: rings round a planet, shockwaves from an eclipse.

**Journey composes scenes** (`src/scene/templates.js`, chosen in `recast` in `journey/cast.js`). Each section gets a template built from its cast (world, lead, accent, centrepiece):
- `plain`, `between` (the glow behind the world's front), `split` (the accent behind it, the lead in front), `among` (the centrepiece between the world's planes), `held` (the glow shrunk into a world's planet and shown only inside it, like a crystal ball: space's, or the cosmos's), `reflect` (the world in its glass), `inside` (a kaleidoscope in it, the glow kept out), `window` (the glow seen only through it), `glass` (the accent only in its glass).
- Each says what it `needs` and what music `suits` it. Journey adds a base weight (`TUNE.sceneTemplates`), fatigue (`J.sFat`) and a little chance, remembers the choice with the section's cast, and may vary it on a third visit (`varySmall`).
- The scene changes on a bar line (`J.sceneLive`). With media loaded it stays plain.
- A template never adds things, only relations between what's already there: "few things at once" holds.
- A **centrepiece** comes in about `TUNE.scene.centreChance` of sections, the least tired object first (`J.oFat`). A per-object `TUNE[key].chance` above 0 (a lab's) takes over the draw.

**The scene editor** (`src/ui/scene.js`, the "Scene" part of the Adjust panel):
- In Journey it shows the live scene, top to bottom.
- By hand: **Compose** builds a template from what's on screen (bringing in the city, the skull or a second layer if the template needs one); each row can move up or down or be removed; trails rows choose a mask (and a second group its layer), object rows choose what fills their glass, world and trails rows choose what drives their weight. **Add** puts a new entry on top. Edits are kept on the preset.

**Demos** (manual presets): "Skull kaleidoscope", "City comets", "Skull in the city", "Behind and in front", "Sunset in the skull", "Comets in the glass", "Tunnel eyes".

## Experiments

Everything here is opt-in from the URL, so the normal page is unaffected:
- `?tune=path=value` overrides a `TUNE` number, e.g. `?tune=hitNone=.4&tune=pace.divBar=.2`. Use it for quick feel comparisons.
- `?lab=name` loads `src/lab/name.js` before the first frame and calls its default export with `{TUNE, J, PACE, registry}`. Use it for trying an idea on one branch without touching the defaults; `src/lab/example.js` is a template. Labs are bundled into the build too. The panel's lab switches last for the tab (`sessionStorage`).
- `?seed=N` makes a run repeatable.
- For bigger ideas, use one branch per idea.

## Testing

Run `npm test` before every PR (`npm run test:dist` also builds and tests the bundle). It runs two files at a time and prints each one's time (about 10 min; `TEST_JOBS=1` for one at a time). `openPage(…, {noDraw: true})` skips drawing for tests that only read Journey or the grid. Tests use headless Chromium via the global Playwright (`npm root -g`).
- `tests/smoke.mjs`: the page loads, draws and locks the beat grid in both renderers with no errors, and `?lab=` / `?tune=` apply.
- `tests/media.mjs`: an image and Chromium's fake camera (`FAKE_CAMERA` flags in `lib.mjs`) show through the tunnel in both renderers, and Journey hands it the lead and takes it back.
- `tests/sync.mjs`:
  - with real audio through the analyser, a synthetic loop in real time, the pulse is drawn a screen's delay before the kick is heard;
  - the kick frame is the brightest;
  - each "follows" mover moves with its own part of the groove.
- `tests/scene.mjs`: in both renderers, each against the same run without it:
  - a fill shows inside the skull and not around it;
  - masked to inside the skull, the trails leave the screen's edges;
  - with `between`, the city's near buildings cover the comets;
  - the skull stands among the city's buildings (they hide its lower half);
  - trail groups put the comets behind the buildings and the ring in front;
  - the city fills the skull and nowhere else; comets in a group seen only through its glass leave the screen's edges.

  And the scene editor: composing "among" by hand, moving an entry, and driving the trails' weight by the kick.
- `tests/objects.mjs`: every mesh object draws and shatters in both renderers, a model with a shape key (the manta) plays it both ways, each style draws the skull differently, and with `?lab=skull` Journey casts the skull as a centrepiece, never under a lens.
- `tests/grid.mjs`: on the synthetic groove, the grid must:
  - lock;
  - hold the tempo within 0.5 BPM;
  - time beats within 15 ms;
  - find the real downbeat at a steady tempo.

  On `fixtures/offbeat.js` (bass notes between the kicks) it must also find about one kick per beat, lock, and hold the right tempo. On `fixtures/rolling.js` (a loud master, past the bytes' ceiling, with a bass note every three sixteenths, louder low down than the kick) it must lock to the right tempo and time the beats.
- `tests/visuals.mjs`: every world, layer and hit shown alone in both renderers draws something (a world or layer isn't black) with no errors, and WebGL doesn't fall back to simple mode (a shader that fails to build does that silently: rain once called a `hash` the trails' shader doesn't have): a quick guard for new visuals.
- `tests/listen.mjs`: on `fixtures/texture.js` (parts that differ in texture, not loudness), the listening hears the hats come in, the breakdown, one drop as the bass returns (and Journey drops then), the noisy wash, the chord moving, the stereo widening and the loop running on; and Journey starts a new section when the hats come in though the loudness hardly changes.
- `tests/foresee.mjs`: a synthetic track's drop is found where the kick comes back (within 30 ms) and its breakdown where it starts; on the texture groove with its drop known, Journey's run-up rises to it, the tension lifts, the breath is held only in the last beat, the drop fires on the moment (before the live listening hears it) and once, and no new section starts in the bars before.
- `tests/beatmap.mjs`: a synthetic 124 BPM track (claps on 2 and 4, hats from bar 16, a kickless breakdown from bar 24, the drop at 32) read ahead: the tempo, every beat within 5 ms (the breakdown too), none missed, the 1, the kick where it is, the drop on its beat, a change on a phrase line; then played on the test's clock, the grid locked from the first beat, every beat on time with the 1 in place, a soft pulse without a kick, and a section on the map's change.
- `tests/quality.mjs`: in both renderers, slow frames lower the resolution, steady ones bring it back, and a step up that's too much is taken back and held off; in WebGL, the trails' shader built from what's drawing matches the full one (within 1/255) over Journey's changes. `__step(n, dt)` steps slower frames.
- `tests/cosmos.mjs`:
  - with `?lab=cosmos`, in both renderers: it draws, the shots change with the music, a jump reaches another system, and the camera never goes inside a body;
  - driving the camera directly: a build draws it in, a drop lets it go, the quiet drifts, and sections land on the arm that suits them and come back to their own system;
  - with the camera held, in both renderers:
    - it visits a black hole, a pulsar, twin stars and a belt;
    - it flies through the belt (inside it);
    - it skims a surface (just above it), and watches a sunrise just above a planet's edge;
    - it goes out to the galaxy and dives into another system;
    - a centrepiece stands as the monument the camera circles;
    - the kaleidoscope folds the view, round the subject too, and closes;
    - the subject wears a wire cage and a ring of motes, and a drop bursts the cage;
    - it lands on a world, flies over its ground, and climbs back out to space;
    - there are no page errors.

  `COSMOS_MODES=` runs just the camera's logic.
- `tests/dance.mjs`: the choreographer changes a layer's move over the bars and moves an object; a breakdown mostly stills them; the comets follow the shape they're given; in both renderers a layer's dance moves its picture and an object's lift moves a part.
- `tests/steer.mjs`: over 150 sections a pinned layer, world and object are always cast and banned ones never; two pinned layers take the lead and the accent; a pinned scene is used whenever it fits; hold stops sections and progression; the group keys steer without freezing Journey.
- `tests/journey.mjs`: over 400 simulated sections (3 in 8 starting in a world's rest, as in a set, so the recipes made for the black get their turn):
  - every world, hit and scene template is chosen;
  - nearly every recipe is;
  - hits appear in 15–40% of sections, and a centrepiece in 15–45%;
  - the extras: a kaleidoscope in 10–40% (folding each of the four), film grain in some, a layer's own speed or size in 20–70%.
- `tests/dj.mjs`: in both renderers the DJ panel opens under the picture (drawn that much shorter) and closes; then with real audio on two synthetic tracks (124 and 128 BPM): each deck's beats are read, the playing deck leads the beat grid, sync matches the tempo and starts on the other's 1 and keeps them in phase (within a few ms), the crossfader hands the grid to the other deck, the EQ kills and the filter closes, Cue goes back to the cue point and Set puts it on a beat, and a 4-beat loop stays inside itself going round and plays on when left.
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
- **Checking one visual.** Solo it (the panel's button, or `tools/look.mjs <key>`, the `check-visual` skill), then compare stills in both renderers.
- **Scratch harnesses** go in the scratchpad, not the repo.

## Known limits

- **The ground is the heaviest thing drawn.** Landed, each pixel marches up to 80 steps of the height (three layers of detail near, two far), plus a normal and a soft shadow. On the user's laptop (a 2106×1016 canvas) it ran at 13 fps even at the auto resolution's lowest step. The ground now skips what can't show (the valley floor, the sky under the ground, strata on worlds without them), its haze reads the air alone, and a slow device draws it smaller before the rest (`Q.world`). Looking the noise up from a texture would make each step several times cheaper, but it changes the mountains' shapes, so it's left as an idea (`docs/audit-speed.md`). In software WebGL it's a few frames a second at 160×90, so the cosmos test lands in 50 ms frames. Baking each world's height into a texture is in `docs/ideas.md`.
- **Simple mode with objects is heavy.** In headless software rendering at 960×540, the knot (1,680 panes) adds about 23 ms a frame (from 30 before the simple-mode rework). On a slow device without WebGL, sections with the big shapes can drop frames.
- **Scenes are tuned by eye, not yet by listening.** The template weights (`TUNE.sceneTemplates`), `centreChance` and the wind and light (`TUNE.ctx`) are first guesses.
- **Engine → UI imports.** Journey and audio modules call into `ui/panel.js` (`updateSectionUI`, `syncSliders`), so there are import cycles. They're all function-level (nothing runs at import time across them), so they're safe; untangling them (a hooks module) was judged not worth the churn in the 2026-09 audit (`docs/audit.md`).
- **Very quiet tracks.** After a loud one the kick floor is forgotten within 1.5 s, but the detector's fixed floors still miss some kicks 20 dB down (`tests/grid.mjs` reports it).
- **Tuned mostly on synthetic audio.** Real-music tuning comes from the user's listening feedback, and from running their tracks through the page offline (`tools/track-run.mjs`, the `track-run` skill). The user's tracks stay out of the repo.
- **Downbeat after a tempo change.** It can slip to beat 3 and stay there. `tests/grid.mjs` reports it (about 47% right after the change in the groove).
- **Unsure downbeat.** Minimal techno with no clap or crash may never pin the 1; the panel says "unsure of the 1".
- **History.** `git log`, and the plans in `docs/` (`composition-plan.md`, `audit.md`, `cosmos-plan.md`), have it.
