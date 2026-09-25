# Composition plan: rebuilding Afterglow around signals, images, operators and scenes

Asked for on 2026-09-24: redo the framework as far as needed so that everything composes. "Solve once, use anywhere":
any image can sit behind, between, inside or in front of any other, masked by any shape, driven by any signal.
Each stage lands on its own with the tests green, is pushed to `claude/festive-gates-6ajaz0` (PR #3) and republished.

## The model
- **Signals:** anything that changes, by name (`scene/signals.js`). Any setting, and any scene entry's weight, can follow any of them.
- **Images:** every visual is a picture with coverage. Three shapes behind one contract:
  - *fields*: per-pixel maths (world planes, hits);
  - *trail groups*: a feedback buffer holding chosen layers (the old single "trails" is group `main`);
  - *meshes*: the 3D objects.
  Worlds split into planes: `back` (sky, far) and `front` (near buildings, ridge, treeline, planet).
- **Operators:** fill (an object's glass shows another image), mask (keep inside/outside another image's coverage),
  fold (kaleidoscope), weight driven by a signal.
- **Scene:** an ordered stack, bottom to top. Any order.
- **Shared context:** one palette per section, one wind, one light, so things feel like one piece.
- **Journey composes scenes:** a scene template per section, within a budget ("few things at once").

## How it draws
`resolveScene()` compiles a scene into a **draw plan**, a list of steps that both renderers run:
trail passes per group, full-screen segments (a run of field entries composed into one cached shader),
mesh draws, and small fill/mask prep passes.

## Stages
- [x] 1. Compositor refactor: draw plans, both renderers run them; default and demo scenes unchanged (golden matches).
- [x] 2. Free order, world planes and objects anywhere (the skull among the buildings).
- [x] 3. Trail groups (comets behind the buildings, rings in front).
- [x] 4. Fills and masks from any image (the city in the skull's glass, the tunnel in its eyes).
- [x] 5. Shared context: section palette, wind, light.
- [x] 6. Journey composes scenes from templates, within a budget.
- [x] 7. Scene UI in the Adjust panel: what / where / driven by.
- [x] 8. Cleanup, docs, final publish.

## Log
- Stage 1: scenes compile to a draw plan (trail groups, full-screen segments composed per run of items and cached, object draws between them). Both renderers run the plan; the default and demo scenes draw as before (golden matches).
- Stages 2–3: any order works, so an object can stand among a world's planes ("Skull in the city"), and trail groups put one layer behind the buildings and another in front ("Behind and in front"). A scene may run `TUNE.scene.maxGroups` groups. Tested in both renderers.
- Stage 4: an object's glass can hold any image: layers (any, the media tunnel too), a trail group seen only through it, or the worlds shrunk into it; and a fill can be limited to one part (the eyes). Demos: "Sunset in the skull", "Comets in the glass", "Tunnel eyes". Masks can be an object or the worlds' front planes.
- Stage 5: `scene/context.js` gives every visual one palette (each section picks triad, analogous, split or contrast), one wind (comets, flow, ribbons, objects and the trails all move with it; gusts on section changes and drops) and one light (the world's, falling on the objects). Golden re-recorded: the colours and motion change on purpose.
- Stage 6: Journey composes every section from a scene template (`scene/templates.js`): plain, between, split, among, reflect, inside, window, glass. Each fits a cast (a world, a centrepiece, an accent), suits some music, and tires like the layers do; scenes change on a bar line and return with their section. A centrepiece now comes in about 30% of sections (`TUNE.scene.centreChance`). Over 400 simulated sections every template is chosen. Golden re-recorded.
- Stage 7: the Adjust panel's "Scene" part lists the stack top to bottom. In Journey it shows the live scene; by hand you can compose from a template (it brings in a world, an object or a second layer if needed), move and remove entries, add new ones, mask trails, fill an object's glass, and drive a world's or the trails' weight by any signal (`drive` on an entry). CLAUDE.md rewritten for the new model.
- Stage 8: simple mode's objects drawn faster (projection without allocations and shared per frame, one fill per pane, edges batched by colour: the knot's cost fell from about 30 to 23 ms a frame headless). CLAUDE.md covers the whole model. Checked on the user's real track offline: Journey moved through split, between, inside, window, glass and plain scenes, with the unicorn and the spiky star as centrepieces; returning sections kept their scenes and varied on a third visit; the beat grid still held 207 of 272 s.

## What's next (not in this rebuild)
- Tune the scene weights, centrepiece share, wind and light by listening (they're first guesses).
- Objects in more places: two objects at once, objects in the trails' groups, an object masking a world.
- More front planes per world (a middle plane), so things can sit at more depths.
- Transitions as scene operations (a new scene wiping in through an object's shape).
