# Afterglow visualiser

A music visualiser that runs entirely in the browser. You drop in MP3s, it analyses them live with Web Audio, and it draws a glowing feedback piece that follows the music. Its automatic director, **Journey**, decides what appears, when, and how it moves.

- Everything lives in one file, `afterglow.html` (about 2,200 lines of HTML, CSS, GLSL and JS). There's no build step, no dependencies and no server. The only external request is the Chakra Petch font from Google Fonts.
- The published copy is a claude.ai Artifact: https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ. To update it, republish `afterglow.html` to that URL.
- The user tests with real tracks, mostly minimal techno. Most feedback is about how it *feels* over a whole set: busy vs sparse, fast vs calm, repetitive vs progressing.

## How it draws

- **Feedback engine.** Each frame redraws the last frame zoomed, spun, warped and faded (`decay`), then adds the current elements on top. This is what makes the glowing trails.
  - WebGL: the `FEEDBACK` shader ping-pongs between two framebuffers.
  - The `DISPLAY` shader then composites the result onto the screen.
- **Crisp layers.** Worlds (backgrounds) and hits are drawn in `DISPLAY` every frame, *outside* the trails, so they never smear. Anything that has to appear or vanish cleanly belongs there, not in `FEEDBACK`.
- **Simple mode.** `make2D()` is a Canvas 2D fallback for browsers without WebGL. **Every visual feature needs a version in both renderers.** The 2D one can be plainer.
- **Parameters.** `render()` builds a parameter object `P` each frame, and `drawGL(t, P)` / `r2d.draw(t, P)` consume it. `t` is *motion time* (`MT`), not wall time. See Pace below.

## Vocabulary: the kinds of things on screen

| Kind | What it is | Keys (in `SPEC`) | How it arrives |
|---|---|---|---|
| **Worlds** | Backgrounds, crisp | `land`, `space`, `aurora`, `city` (plus none/black) | Fade, or cut on the bar |
| **Layers** (`ELEMS`) | Continuous glowing effects in the trails | `ring`, `scope`, `plasma`, `burst`, `comets`, `flow`, `ribbons`, `horizon` | Fade, or cut on the bar |
| **Hits** (`HITS`) | One-shot shapes fired by the music, crisp | `star` and `outline` (downbeat), `sparkle` (stabs), `shock` (pulse) | Snap in, then snap or flicker out |
| **Lens** | Transforms everything, draws nothing itself | `sym` (kaleidoscope folds), `mirror` | Eases in, or flips on the bar |
| **Motion / colour** | How the feedback moves | `decay`, `zoom`, `rot`, `warp`, `wander`, `colorSpeed`, `hueDrift` | Continuous |

- **Movers** (`mods` on a preset): per-setting automation such as drift, follows bass/mids/treble, pulses on beat, or jumps on beat.
- **Presets** (`BASE`, 14 of them): hand-made looks for manual mode. Journey also reads them as **recipes**.

## Journey (the automatic director)

Journey lives in `stepJourney()` plus the helpers around it. The main principle, which came from user feedback: **few things at once.** The user found four or five layers plus kaleidoscope copies "mush". One or two layers over a background works.

1. **Roles per section.** Each section is built from:
   - one **world**, chosen per section by `chooseWorld`, which lasts about 50 s and then rests;
   - one **lead** layer, held for the whole section;
   - one **accent** layer, off until its trigger fires: downbeat, stabs, melody swell, or the start of a loud phrase;
   - at most one **hit**;
   - optionally a **lens**.

   `recast()` does the choosing, via `scoreElems`, `chooseAccent` and `chooseHit`.
2. **Sections.** A running fingerprint of the music (kick density, stabs, brightness, bass, melody, loudness) is compared against its recent average.
   - A lasting change becomes a new section, which takes effect on the next downbeat.
   - Sections that come back are recognised (`matchType`) and restore their cast, recipe and colour.
   - From the third visit on, a returning section varies its accent or hit (`varySmall`).
3. **Recipes.** `recipeOf()` reads a preset as ingredients: lead, accent, hit, lens, world, motion and movers.
   - `pickRecipe()` chooses one per section to suit the music, the world and the intensity, and avoids repeats and tired leads.
   - The recipe's motion is blended 50/50 with Journey's own, and its movers run during Journey.
   - Hand edits to presets carry into Journey.
4. **Lens.** A section's lens comes from its recipe, or occasionally from the section itself.
   - It switches on and off on bar lines, with hysteresis: on above tension 0.35, off below 0.2.
   - It's never used over a world.
   - On intense phrase lines its fold count shifts.
5. **Transitions.** `pickStyle()` decides per section whether changes **fade** or **cut**.
   - A cut holds each switch until the next downbeat, then snaps it in with a pulse and wipes outgoing trails.
   - Drops and Nudge always cut. World rests always fade.
6. **Progression.** Minimal music may never produce a section change, so Journey moves on by itself. About every 16 bars (scaled by Evolution speed) with no change, it takes one `progress()` step, on a phrase line:
   - first a new accent or hit;
   - then a colour, lens or pace shift;
   - then a new recipe and lead.

   **Adaptive sensitivity** (`stillness()`): the longer nothing changes, the smaller a change needs to be to count as a new section. **Fatigue** (`J.fat`) builds while a layer is on screen and counts against choosing it again.
7. **Pace.** Each section gets a pace from 0 (floating) to 1 (frantic), with contrasting paces for consecutive sections. `setPace()` maps it to:
   - motion speed, from 0.3× to 1×, applied through `MT`;
   - kick strength, from 0.2× to 1×;
   - pulse division: once a bar, every other beat, or every beat;
   - how closely the waveform and level-driven motion follow the audio.

   This fixed "everything vibrates at one speed". Hits still age in real time. Manual mode runs at pace 1.

## Timing: kicks, stabs, and the beat grid

- **Onsets** (`analyse()`): kicks are sudden rises in the low band, and stabs are rises in the mids. Kicks feed the beat grid; stabs fire `onHitFX` (sparkles, "on stabs" accents).
- **Beat grid** (`G`, `gridKick` / `gridTick` / `gridFrame`):
  - **Tempo.** `estimatePeriod` finds the beat length that best explains the gaps between recent kicks as whole numbers of beats.
  - **Clock.** It locks after three kicks on the grid, and each on-grid kick nudges it back into phase. It keeps ticking through missed kicks and breakdowns for about 30 s.
  - **Downbeat.** It's learned from where claps fall (2 and 4) and where crashes and changes land (the 1). It only moves after two bars of consistent evidence.
  - **Resets.** Seek, pause or play re-lock the phase but keep the tempo. A new track resets everything.
- **What follows the grid.** `gridBeat(pos)` is the single per-beat hook, with pos 0 = the downbeat. It drives the pulse (`firePulse`), star and outline, cuts, bar and phrase accents, section changes, spin reversals and progression. Until the grid locks, detected kicks drive it directly.
- **Phrases.** 4-bar lines are counted from the first bar of the current section (`J.phraseAnchor`), not from the start of the track.

## Conventions

- **Style.** Match the existing code: dense modern JS, short names (`J`, `G`, `P`, `eff`, `jState`, `tgt`), and one-line comments that say *why* in plain words. Section banners look like `/* ---------- name ---------- */`.
- **State.**
  - `curP` holds the current settings and `eff` holds them after movers.
  - `active` is the preset in use; in Journey it's `jState`, which Journey writes to.
  - The sliders in the Adjust panel are generated from `SPEC`, so adding a setting there adds a slider.
- **Adding a world or hit:**
  1. Add it to `SPEC` (and to `WORLDS` or `HITS`).
  2. Draw it in `DISPLAY` and in `make2D`.
  3. Pass it through `P`.
  4. Give it a score in `chooseWorld` or `chooseHit`.
  5. Consider giving it a recipe in `BASE`.
- **Accessibility.** Respect `reduceMotion`, which halves flashes. Keep the UI usable at phone width.
- **Narration.** The Adjust panel narrates Journey (`updateSectionUI`, `#jGrid`). Keep that narration accurate when behaviour changes.

## Testing

There's no test suite. Verify changes in headless Chromium with Playwright:
- `npm root -g` has `playwright`.
- Launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL, or `--disable-webgl` for simple mode.
- Keep test harnesses in the scratchpad, not the repo.

Useful facts:
- **Built-in beat.** With no track loaded, `synth()` generates a steady 120 bpm kick, so the page reacts without audio. For grid tests, swap in a structured groove in a test copy: claps on 2 and 4, a crash on 1, dropped kicks, a breakdown, a tempo change.
- **Debug state.** `window.__jdbg()` returns Journey's state: recipe, lead, accent, hit, world, lens, pace, grid, fatigue, progression and more.
- **Reaching internals.** Tests typically `sed` a copy that exposes internals before the closing `})();`, for example `window.__t = {J, G, ...}`.
- **Software WebGL is slow** (about 6 fps). The kick detector misses beats and dt clamps at 0.05, so check timing and behaviour in simple mode (60 fps) and use WebGL for screenshots and shader compile checks.
- **Force situations directly.** Call `newSection`, set `J.recast = 'fresh'`, pin `J.tension` in a rAF loop, or set slider values in manual mode (press `A` to leave Journey).

## Known limits and tuning knobs

- **Tuned on synthetic audio.** Everything so far has been checked on built-in beats, not real tracks. Real-music tuning comes from the user's listening feedback.
- **Downbeat.** Minimal techno with no clap or crash may never pin the 1; the panel says "unsure of the 1". The weights are in `gridTick`: broadband-on-1 vs clap-on-2/4 (0.7).
- **Knobs that are one number each:**

  | What | Where |
  |---|---|
  | Cut vs fade threshold | `pickStyle`, 0.9 |
  | How often hits appear | the `none` score in `chooseHit` |
  | Progression period | 64 beats in `gridBeat` |
  | Stillness ramp | 20 to 120 s in `stillness()` |
  | Pace mapping | `setPace` |

- **History.** Earlier work, oldest first: a WebGL-failure fix, simple mode, movers, comets and shockwaves, Journey, onset-based kicks and stabs, section fingerprints, three-role layering, cut transitions and the star, recipes and lens, progression and fatigue, the beat grid, aurora/city/outline/sparkles, pace. `git log` has the details.
