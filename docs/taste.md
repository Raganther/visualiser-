# Taste

What the user likes and doesn't, in their words where possible. It's the brief for every change to how Afterglow looks or behaves: read it before building, and add to it when the user reacts to something. Each principle keeps its evidence, so it can be weighed and revised.

**How it grows:**
- the 👍 / 👎 buttons (or + and −) on the published page save the moment to the Artifact's database (collection `moments`);
- the `taste-review` skill reads those moments and finds what the likes and dislikes share;
- what holds up across several moments becomes a principle below, and a change to tuning (`src/tuning.js`) or Journey's weights.

A single like is a hint, not a rule. Two or three that agree make a pattern.

## The listener

- Plays real tracks, mostly **minimal techno**, and watches over a **whole set**, not a clip.
- Judges in these terms: **busy vs sparse, fast vs calm, repetitive vs progressing.** Say which way a change moves each one.
- Tries the published Artifact on their own devices, some of them slow.

## Principles

1. **Few things at once.** One or two layers over a world. Four or five layers plus kaleidoscope copies read as "mush".
   - *Evidence:* the early layered builds; this led to Journey's roles (one world, one lead, one accent, at most one hit).
   - *In practice:* a new visual replaces something in a section; it doesn't add to the pile. Templates relate what's there rather than adding.
2. **Crafted, not generic.** Shapes need depth, silhouette and variation. Flat or uniform reads as cheap.
   - *Evidence:* the first city was "naff" (flat rectangles, noisy windows, no depth), and was liked once it had rows fading into haze, setbacks, antennas, windows in each building's style, neon and traffic. The asteroids "just look like loads of small spheres"; they should be "all different shapes and sizes".
   - *In practice:* before calling something done, ask whether a real one would look like that up close. Vary size, shape and detail, and give things layers of depth.
3. **Atmosphere, not just objects.** Space wants gas, vapour and nebula around the things in it, not bodies on black; worlds want air, relief and weather, not flat discs.
   - *Evidence:* "it's missing gas and vapor" about the asteroid belt; the planets' surfaces "look kind of flat", so they wanted atmospheres.
4. **Places to explore.** The strongest reaction so far was to space as a **3D place a camera moves through**, with the track's shape leading (builds pulling in, drops letting go), set pieces to discover, and the galaxy to the surface.
   - *Evidence:* the cosmos, from the user's own idea: "really, really awesome" for the rebuilt piece overall, and "looks cool", "pretty cool" for the cosmos.
5. **In time with the music.** The pulse lands on the kick, not after it. Timing errors are felt at once.
   - *Evidence:* the kick and beat-grid fixes; brightness in the trails peaked 8 frames late and was moved out.
6. **Smooth beats rich.** A slow frame rate spoils everything. The user noticed slowness before anything else.
   - *Evidence:* "running very slow" led to the frame-rate readout, the trails shader built from what's drawing, and the resolution that follows the frame rate.
7. **Legible.** The user should be able to tell what's on screen and why, and see anything on its own.
   - *Evidence:* confusion about "lots of other stuff imposed over" the cosmos led to the panel's On screen line, Solo, and the Cosmos preset.
8. **Painted worlds are stylised posters.** A flat world can't compete with the cosmos on realism, so it doesn't try: a bright, saturated sky behind crisp dark silhouettes, depth from layers stepping paler into the haze, one big light (a sun or moon) with lit sides and cast shadows, and the music moving the whole scene (the ridges re-forming, the district changing, the lights following the build), not just small details.
   - *Evidence:* the landscape ("super cool": "dynamic… bright contrasting colours… a retro feel… stylised") against the night sea, underwater, dunes and forest ("flat, 2D-ish, not really much going on"); the city's buildings "constantly bouncing up and down" were "annoying".
   - *In practice:* value contrast first (the sky should be the brightest thing), two or three bold hues from the palette, big shapes that change with sections and builds. Realism and places to explore belong in the 3D worlds.

9. **Symmetry drives the composition; motion is calm and centred.** Movement should read as geometry (turns round the centre, breaths, concentric swirls, mirrored pairs meeting in the middle), not bodies jiggling and drifting about. Asymmetry is the spice, not the base.
   - *Evidence:* the first dance was "too much movement and yo-yoing", "janky", things "moving around a lot" off centre; they love the mandala "as it evolves and unfolds" and the kaleidoscope's symmetry (2026-09-29).
   - *In practice:* keep things centred (the centre's wander is small), springs damped so poses ease in, comets and particles in mirrored or rotational patterns most of the time, slow moves over phrases rather than quick ones every beat.
## Open questions

These are things to learn from 👍 / 👎, not to assume:
- Which worlds and scenes hold up over a whole set, and which tire?
- How often should the cosmos change system? How close should the camera fly, and how fast?
- Is the kaleidoscope liked at all now, and in which sections? (Yes: "so cool", 2026-09-29.) Which kind: wedges, the mirror box, the dive?
- How much symmetry is too much? They asked for a balance with asymmetry.
- Centrepieces (skull, unicorn, maths shapes): welcome in about 30% of sections, or less?
- Calm sections: still and spacious, or do they feel empty?

## Log

The newest entries go at the bottom: the date, what was learned, from what, and what changed.

- 2026-09-26: seeded from the feedback so far (principles 1–7).
- 2026-09-26: the cosmos's world surfaces looked "kind of flat"; they want atmosphere. Added air round each planet (limb glow, sunset at the terminator, haze), relief lit from the star, and clouds casting shadows. Principle 3 (atmosphere) holds for planets as well as the belt.
- 2026-09-28: the cosmos's fold "works really well"; they want a mirrored kaleidoscope on anything (the whole picture, inside the skull), and still like the glow's own lined folds. Added the kaleidoscope (K: everything, the world, the glow, inside the object) beside the old folds (Shift+K). They asked to change each effect's speed: added each layer's own speed, size and sound. New layers from the ideas they picked: lasers and waveform lines.
- 2026-09-28: they asked for better music recognition and gave four reference tracks (three AI-made minimal techno: Mutant Pulse, Hypnotic Groove, Evolving Groove; and Pink Floyd's Us and Them, the one real recording, a very different style). Offline, the techno's loudness is a flat line and its parts are the hats going in and out, noise against tone, and the bass dropping out; Us and Them's loudness really swells. Built the listening (texture, bass, filter, notes, width, bar memory), fixed clipped sub-bass on loud masters and a beat grid fooled by rolling basslines (Mutant Pulse: 39 s locked at 160 BPM, now nearly all of it at 128), and made music without a clear dance pulse calmer (Us and Them had run "frantic").
- 2026-09-29: the new painted worlds looked flat; the landscape's stylised sunset is the model, and the city's bouncing annoyed. Principle 8 (painted worlds are posters). The city: the bouncing cut to a breath (and a leap on drops), a glowing dusk with searchlights on the bar, blocks lit on the moon's side and shadowing the rows behind, windows and neon switching on as the build rises (flickering on stabs), and each section's own district rising in a wave. The sea, underwater, dunes and forest redone in the same style.
- 2026-09-29: they want to use Blender to make 3D objects and animate them. First one, Claude's choice: a manta ray (modelled in Blender from Python, `tools/blender/manta.py`), gliding with its wings beating in step with the bar from a shape key. The pipeline takes the user's own .glb too (`tools/import-glb.mjs`, the `blender-object` skill). To learn: whether animated creatures beat abstract shapes as centrepieces.
- 2026-09-29: playing with layers "is changing the world also sometimes". Cause: ← → change the last layer's speed only while the layers group is open (it closed after 8 s untouched) and a layer has been touched; otherwise they switched to the next preset, silently. Now a group stays open 20 s, ← → never switch presets inside one, and a preset change says its name. Principle 7 (legible): nothing big should change without saying so.
- 2026-09-29: the layers "repeat the same patterns again and again", the skull "always does the same thing"; they want everything to improvise and dance (the comets swirling round each other, making geometric shapes). Built a choreographer (`scene/dance.js`): every layer and object picks a move every few bars to suit the music (sways, bounces, snap turns, orbits, head bangs, lunges, a part lifting off), on springs, remembered per section, stilled by breakdowns, a spin burst on drops; the comets trace roses, Lissajous knots, star polygons, spirals and chases; the skull's jaw sings with the mids and it shatters only on drops. To learn: whether it reads as dancing or as busy (principle 1, few things at once), and how big the moves should be (`TUNE.dance`).
- 2026-09-29: they asked to direct Journey as it goes, adding and removing things, rather than only stopping and starting it. Built steering: while Journey runs a group's numbers keep, ban or free any layer, world, hit, object or scene, ; holds the look, R moves on; Shift+number still takes over by hand.
- 2026-09-29: from the earlier idea of switching object styles ("could we switch between different styles for the objects"): five styles, glass wire, solid, outline, hologram and points, chosen by Journey per centrepiece to suit the music, or by hand (O then Y). To learn: which ones they like.
- 2026-09-29: Journey "always seems to stay within the cosmos" and never used the kaleidoscope on its own; they want Journey to reach every setting in any combination. Offline, on three of their techno tracks, Journey moved through 6–9 worlds (the cosmos 5–15% of the time), so the likely cause was the Cosmos lab switch, remembered for good: it now lasts only for the tab, and the panel says when it holds the cosmos. Journey now chooses extras per section: the kaleidoscope (about a fifth of sections, folding whatever suits the cast), film grain, and the lead's or accent's own speed and size; K steers the kaleidoscope while Journey runs.
- 2026-09-29: the dance had "too much movement and yo-yoing", things moving round off centre; they asked for symmetry to drive the composition: the manta coming towards the screen and showing its belly, the skull centred, comets drawing symmetric, concentric, geometric lines (a swirl, a funnel), particles meeting in the middle from both sides, a balance of symmetry and asymmetry. They love the mandala unfolding and want one that constantly moves outwards; the kaleidoscope is "so cool", and they want to zoom into it revealing more folds, a hall-of-mirrors box kind, and fractals. Built: centred, symmetric moves with near-critical springs; the centre's wander capped; the manta's approach and rise; mirrored and concentric comet shapes and particle modes; the unfolding mandala; the kaleidoscope's mirror box and dive; a fractal layer (the Kali set).
