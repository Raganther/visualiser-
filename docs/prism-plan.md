# The prism plan: one sheet of facets that becomes any shape, in a 3D room

The user loves the faceted objects and the way their facets light up (`docs/taste.md`, principle 10). Over 2026-10-09 and 10 they asked for the prism to open into a sheet that wraps round and rejoins, rises into mountains, folds back into any shape, opens up again, and engulfs the camera; and then for the prism to stand in a 3D room with real lights and lasers that reflect off its facets and shine into it. This is the plan agreed, in order. Stages 1 and 2 are built (the sheet, then the Prism, `objects/prism.js`); the rest is to come.

## Decided

- **The prism and the Fold become one object, the Prism**, with one shared brain: the music's patterns (the kick's rings and cascades, the stabs' wedges, checker and bands, the hats' sparks, the melody's spiral, life, the improvising symmetric figure, the drop's run-up), the colours, the textures (glass, solid, outline, hologram) and, later, the lighting. (Done in stage 2: one brain in `objects/prism.js`; `fold.js` is gone.)
- **The sheet is the body; the Fold's forms and the prism's gem are shapes it folds into.** The prism's nine shapes (`SHAPES`) are radii by direction, so the sheet's closed form takes them directly, along with the superformula's.
- **Cut the sheet in the gem's own pattern** (the icosahedron's twenty faces, so the closed gem keeps the prism's five-fold look exactly), opening like a flower into a flat five-pointed star of facets. The user's choice to make; Claude recommended this one. Tubes and rings stretch a star more than a square, so for those the swarm moves the facets onto the square sheet (`sheetGeo`).
- **Keep both kinds of light.** The patterns are light *from* the facets (each glows like an LED panel, by rules tied to the music); the room's lamps are light falling *on* them (by where each lamp is and which way each facet faces). A facet's colour is its own glow plus the light it catches. They talk to each other: a spotlight landing sets off a cascade there, a laser leaves a fading trace on the facets it hits, the kick's ring on the prism throws a ring onto the walls, a hologram ignores the lamps. Journey picks the balance per section (calm: soft lamps, faint patterns; intense: the patterns full, the lamps strobing).
- **Few things at once** still holds: a dark room, few lamps, the music bringing things in one at a time.

## Stages

1. **The sheet** (built: the Fold). Eight forms eased into one another: sheet, peaks, waves, tube, ring, halo, twist, ball.
2. **Merge into one Prism** on the gem-cut sheet (built, 2026-10-10): the gem closed, opening like a flower into the star, the sheet's forms, folding back into any closed shape; one shared brain. The cut is five gores from the front corner to the back (`gemSheetGeo`), so the open star is a five-petal pinwheel (each gore turns a tenth of a turn along its length, as the icosahedron's faces zigzag). The tube, ring, halo and twist stay on the square sheet; changing body is a quick shatter and gather, until the swarm (stage 7) can fly the facets across.
3. **The room, the camera and the lamps.** A void with haze, a box, a prism inside a prism, or the sheet closing round the camera. A 3D camera that flies round, in close, through a facet that swings open, and inside. Lamps that light the facets (glints as a spot sweeps, coloured sides), mirror-ball spots thrown onto the walls by the facets, shadows on the floor, beams in the haze. Needs proper depth (the facet engine sorts far to near today).
4. **3D lasers.** Rays traced each frame against the facets: bouncing off at the true angle, entering the glass and bending, splitting into a rainbow (a real prism), trapped inside and drawing a symmetric web, flaring where they touch. The 2D lasers' shows (fan, crossing, star, scan) aimed at the prism; a drop fires them all through it.
5. **Journey's light show.** The lamps and lasers on the music: the kick strobes, stabs swing the spots, the hats sparkle the facets, a build turns every lamp onto it, a breakdown leaves one soft spot.
6. **Other layers in 3D:** orbits and comets as lights circling it (lighting it as they pass), fireflies as motes in the haze, the stargate's rings rushing past the camera, rain through the light.
7. **The swarm and wrapping onto objects.** Facets let go and fly as shards into any shape, including ones a single skin can't make (separate pieces, many limbs); the closed sheet wraps onto the skull, the heart, the manta or a Blender model.

## Also waiting on the user

- Their new stall log from the 2019 Mac (Graphics on Auto) after the every-world-in-its-own-pass fix, for any freezes left.
- Jev (an AI model they mentioned) composing shapes live: it needs their API access; the sheet and the swarm make a shape a short recipe an AI could write.
