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
- [ ] 2. Free order, world planes and objects anywhere (the skull among the buildings).
- [ ] 3. Trail groups (comets behind the buildings, rings in front).
- [ ] 4. Fills and masks from any image (the city in the skull's glass, the tunnel in its eyes).
- [ ] 5. Shared context: section palette, wind, light.
- [ ] 6. Journey composes scenes from templates, within a budget.
- [ ] 7. Scene UI in the Adjust panel: what / where / driven by.
- [ ] 8. Cleanup, docs, final publish.

## Log
- Stage 1: scenes compile to a draw plan (trail groups, full-screen segments composed per run of items and cached, object draws between them). Both renderers run the plan; the default and demo scenes draw as before (golden matches).
