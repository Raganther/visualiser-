# Morphing objects and the Prism's own kaleidoscope

The user found 3D objects over simple 3D worlds, under a kaleidoscope, "really cool": it reads as a machine or a life form
morphing. They asked for more natural, morphing objects that pair with the kaleidoscope, and for the Prism to hold a
kaleidoscope of its own (a 3D simulation of what a kaleidoscope produces, not the picture folded). Then: "build all of
those suggestions… plan out your work beforehand". This is the plan and its log.

## Stage 1: the engine (`render/sdf.js`, `objects/sdf-object.js`)

Shapes that flow and merge are distance functions, ray-marched, not meshes:
- **WebGL:** one program per object, built from a shared prelude (the mesh objects' camera, `CAM` and `FOCAL`: a pixel's ray
  into the object's own frame; three lamps; a studio environment for reflections, its colours the palette's; noise; smooth
  union) and the object's own `map(p)` and `shade(...)` (and, for the see-through ones, what lies inside). It draws a square
  round the object's bounding sphere on screen, so it costs only where the object is.
- **Simple mode:** the same shape marched on the CPU (each object has `map` in JS too) at about 44×44 over its square, shaded
  plainer, and laid over the picture smoothed.
- **The music**, gathered once for all of them (`sdfObject()`): the kick (a flash that fades), the bass, the hats, a stab,
  the tension, a drop's run-up, the drop (its age), a breakdown, the beat's length, motion time; and `ex`, a splash or shatter
  that a drop or `breakApart()` starts.
- Each object places itself like the others (`P.anchor` when the world carries objects, else the centre), dances on its own
  terms, and has a `cover` pass (white where it is) for masks and fills.

## Stage 2: the six objects

| Key | Label | Shape | The music |
|---|---|---|---|
| `ferro` | Ferrofluid | Black glossy liquid: a body and three drops orbiting it in a smooth union, symmetric spikes rising out of it (a field of directions spread evenly over it) | The bass raises the spikes, a kick jolts them, a run-up grows them, a breakdown melts it smooth; a drop flings its drops out and they fall back |
| `mercury` | Liquid metal | The same body, chrome, reflecting the studio in the palette's colours, no spikes | Each kick pulls a droplet out and snaps it back; the bass wobbles it; a drop splashes it into beads that run back together |
| `bubble` | Soap bubble | A thin wobbling film: rainbow interference flowing over it (thickness from noise), clear through the middle | The bass wobbles it, the hats speed the swirl, a drop splits it in two and they merge again |
| `cell` | Living cell | A translucent membrane, a glowing nucleus, small organelles drifting inside | It breathes with the bass, the kick flashes the nucleus, a drop divides it (the membrane pinching into two, the nucleus splitting) and it slowly rejoins |
| `coral` | Brain coral | A sphere carved by a gyroid into a breathing maze | The maze breathes with the bass, rings of colour run over it on the kick, a run-up tightens it, a drop shifts the pattern |
| `growth` | Growing crystals | A cluster of hexagonal crystals pointing out from a heart (the existing mesh `crystal` stays) | They grow through a build, light runs up them on the kick, a drop flings them out and they grow back |

## Stage 3: the Prism's own kaleidoscope (`objects/jewel.js`, layer `inner`)

- **A, skin:** each facet shows coloured beads folded into its triangle's six mirror sections (the barycentric coordinates
  sorted), so neighbours mirror each other and the whole gem is one kaleidoscope; the beads drift with the music.
- **B, mirrors:** the gem's inside is mirrors. A ray refracts in through the facet and bounces between the gem's twenty big
  faces (planes fitted to its current shape each frame), meeting coloured glass shards that tumble inside with the music, as
  in a real kaleidoscope's object cell; each bounce dims a little.
- **C, tunnel:** the same mirrors with no shards: glowing seams where two mirrors meet, repeating for ever into the gem.
- Chosen by Journey per section (`TUNE.jewel.inner`), held by hand with K then P (auto, off, skin, mirrors, tunnel). Only on
  closed forms (an open star has no inside). Simple mode: the skin's pattern as each facet's colour.

## Stage 4: wiring

Registry, keys (O then F ferrofluid, D liquid metal, V bubble, N cell, A coral, Z growing crystals), presets, tuning
(`TUNE.sdf`, one line each), Journey (centrepieces, never in the room), CLAUDE.md, tests (`objects.mjs` covers drawing and
shattering for every object; a check of the Prism's inside), golden re-recorded, a preview.

## Log

- 2026-10-15: planned.
