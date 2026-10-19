# The space plan: one 3D stage the layers and the objects share

On 2026-10-18 the user found the lasers weren't shining through the objects: the subject (`scene/subject.js`) treats the centrepiece as a circle on the screen, and the lasers, comets, orbits and fireflies are flat layers drawn round it. A beam "stops" where the circle starts and the object, drawn over the trails, hides the rest; a comet "goes behind" only by being covered. The user's point: for a laser to shine on and through an object, or a comet to circle round its back and light it as it passes, they have to be in the object's 3D space.

The parts exist, tied to the full Prism and its room (`docs/prism-plan.md`, stages 7–10): 3D lasers traced against its facets (`objects/beams.js`), lamps placed in space with cones (`STAGE.lamps`), the orbits and comets as lights circling it, fireflies as motes in the haze, the stargate's rings past the camera (`show3d` in `objects/prism.js`). They run only for that object, only with the room world on, and Journey leaves that object out. This plan lifts them into a stage every object stands on, room or not.

## What there is now

| Object | Lit by | A ray can be traced against it |
|---|---|---|
| wire objects (`render/mesh.js`) | the world's light, a direction on screen (`uLightDir`) | its panes (positions worked out on the CPU for simple mode) |
| lit objects (`render/lit.js`) | three point lights of its own rig (`U.lights`), a shadow from the first | its ~3k-triangle simple-mode mesh |
| morphing objects (`render/sdf.js`) | three lamps, the key's direction its own (`uLd`), the others fixed | its distance function in JS (`map2d`) |
| Journey's Prism (`objects/jewel.js`) | three lamps of its own | its facets (`facetPlace`) |
| the full Prism (`objects/prism.js`) | `STAGE.lamps`: six, three of them the layers' | its facets, by `traceBeams` |

They share one camera (at z 3.2 looking down −z, focal length 2.6: `CAM`, `FOCAL`), so one view space can hold them all.

## Decided (Claude's calls; the user can overturn them)

- **One space, the objects' own.** The view space the objects are already drawn in, the centrepiece at its place (`U.pos`) and size. Every 3D thing is placed there, so it projects with the same camera and has a depth to compare with the object's.
- **Lights are the common language.** Every object takes the stage's lights (up to six point lights: where, colour, strength, and a cone for a lamp) besides its own look. A comet passing is a light passing, so every kind of object lights up as it goes by, without each object knowing about comets.
- **A layer with an object gets a body, without one it stays flat.** The 3D versions come in only while a centrepiece is on screen (the subject, eased in and out). As they come in, the flat versions turn down (`flat`, as the room does now), so it's one laser show, not two. With no object nothing changes.
- **The genome decides the physics.** Its material is what the object does to light: glass bends and splits it (the true index, a rainbow out), metal reflects it at the true angle, stone scatters it into a soft glow on the surface, neon soaks it up and glows its own colour. Its symmetry is how many beams, comets and flares, set round the object's own axis. Its hue is the lights' colours. Without the genome, the object's own material chooses, as now.
- **Occlusion is real.** Anything behind the object (deeper than it at that point) is drawn before it and hidden by it; anything in front is drawn after it. One small pass after the objects for what's in front, like the facet engine's beams over the glass (`beamsGL`).
- **No room needed.** The room stays a world the stage can stand in (its floor catches shadows, its haze shows beams), but the stage works over any world or on black.
- **Few things at once** still holds: at most a few beams calm, more as it builds, all of them on the drop (the full Prism's ladder, `TUNE.prism.lasers`).

## Stages

1. **The stage** (`scene/space.js`, a leaf module, `SPACE`): the lights (up to six: key, rim and fill from Journey's light, three for the layers), the beams' segments in view space with their colours, and the subject in view space (its place, its depth, and its radius, for a quick test before tracing). `main.js` fills it each frame after the objects' params, where `subjFrame` runs now. Ported from `scene/stage.js`, which becomes the room's part of it. *Test:* a light placed in front of the skull and then behind it, its projected place and depth correct.
2. **Every object lit by the stage's lights.** Wire objects: per-pane point lights in the vertex shader (they have only a screen direction now) and the same in simple mode. Lit objects: the stage's lights added to their rig (the rig stays their own key, so a lit object still looks itself). Morphing objects: their three lamps from the stage, with point lights. Journey's Prism: its lamps from the stage. *Test:* a coloured light circling each kind of object lights the side facing it, in both renderers.
3. **Comets and orbits as lights in 3D.** With a subject, the comets fly their figures in 3D round the object (a rose or a star in a plane tilted by the dance, the genome's count of petals), and the orbits' flares circle it on tilted rings, passing behind it and in front. Each is a stage light (the nearest three), with a tail in view space. Drawn with real occlusion. *Test:* a comet's light behind the skull is hidden by it; passing in front it lights the skull's face.
4. **Lasers traced against any object.** `traceBeams` generalised from the Prism's facets to any triangles: the wire objects' panes (posed on the CPU each frame: the skull's 1,200 or the knot's 1,680 against a dozen rays is cheap), the lit objects' simple-mode mesh, Journey's Prism's facets. The morphing objects are marched instead, by their JS distance function. The material by the genome as above; where a beam lands, those panes or facets light (the wire objects' facet light, the Prism's `trace`). Beams from the layer's shows (a fan from below, the corners crossing, a ring from round the screen) start at the edge of the space and aim in. The flat lasers fall to `flat` while this runs. *Test:* a beam aimed at a glass sphere leaves it bent and split; at a metal one it leaves reflected; behind the object it's hidden.
5. **Fireflies and the stargate in 3D.** Fireflies as motes in a shell round the object, in the genome's rings, those behind it hidden, each a tiny light the object catches when near; the stargate's rings rushing past the camera round it (the Prism's `show3d`). *Test:* motes on both sides of the object, those behind it hidden.
6. **Journey and the switch.** An Explore switch, **The layers in 3D round the object** (`S.explore.space`, on by default once tested), in the panel and the phone view. Journey favours lasers, comets, orbits and fireflies a little with a centrepiece while it's on (`TUNE.combos.pairs`). The full Prism's own lasers and lights move onto the stage, so it and the room keep working as now. Golden re-recorded once, with the reason. *Test:* over many sections with an object, the 3D versions come in and the flat ones fall; off, the picture matches today's.
7. **Speed.** Measured with `tools/bench.mjs` (a skull with lasers, the knot with comets, a lit object, a morphing one). Budgets: beams a frame, panes tested per beam (a bounding sphere first), and lights per pane in the shader. Simple mode draws the lights on the objects flat, without the tracing's bounces.

## Not in this plan

- Shadows from the layers' lights (only the lit objects' key casts one now).
- The worlds lit by the layers' lights (a laser hitting the Cathedral's walls).
- Light bouncing from one object onto another.
- The mood ring and the other layers without a body (they could follow later: the mood ring as a halo of light round the object, colouring it).

## Log
- 2026-10-18: planned.
- 2026-10-18: stages 1–3 built. `scene/space.js` holds the lights (six at most, the brightest kept), the subject's frame and what's in front of it; the comets fly their figures tilted into depth (`comet3d` in `fx/effects.js`) and the orbits' flares circle it on real orbits, each a light; every kind of object adds the lights while it's the subject, in both renderers; the heads in front are drawn over it (`render/front.js`). The bubble and the cell (their own `obj()`) aren't lit yet. Tested in `tests/space.mjs`.
- 2026-10-19: the bench (`src/lab/bench.js`, `dist/bench.html`): the user asked to test each system alone and add them one at a time once audited. The order agreed: 1 the object and the light rig, 2 the genome, 3 the music driving the rig, 4 the comets and orbits as lights, 5 3D lasers, 6 a space round it (the void and the room, then the 3D worlds), 7 the kaleidoscope, 8 Journey; the flat glow layers, the trails and the hits after, one at a time. Step 1 built: the rig in `scene/space.js` (`SPACE.rig`, highlights, the objects' own lamps set aside, the lit objects taking it as their own lights), and songs to watch with (`audio/songs.js`).
- 2026-10-19: the conductor and the lasers in 3D on the bench (steps 2–3 and a first form of 5 together, as the user asked: the object, the lighting and the lasers performing as one). The genome gained motion genes; `scene/conductor.js` turns the object a notch of its symmetry at a time and the rig with it, flashes and swings the lights with the kick, stabs and hats, draws them in through a build, leaves the key alone in a breakdown and swings them behind on the drop; `scene/lasers3d.js` places the lasers round the object and traces them against it as a sphere (stone and neon stop them, glass bends them into a rainbow, metal reflects them), each strike a light on it. Not yet: tracing against the object's real facets, the conductor in Journey.
