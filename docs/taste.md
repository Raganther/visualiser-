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
3. **Atmosphere, not just objects.** Space wants gas, vapour and nebula around the things in it, not bodies on black.
   - *Evidence:* "it's missing gas and vapor" about the asteroid belt.
4. **Places to explore.** The strongest reaction so far was to space as a **3D place a camera moves through**, with the track's shape leading (builds pulling in, drops letting go), set pieces to discover, and the galaxy to the surface.
   - *Evidence:* the cosmos, from the user's own idea: "really, really awesome" for the rebuilt piece overall, and "looks cool", "pretty cool" for the cosmos.
5. **In time with the music.** The pulse lands on the kick, not after it. Timing errors are felt at once.
   - *Evidence:* the kick and beat-grid fixes; brightness in the trails peaked 8 frames late and was moved out.
6. **Smooth beats rich.** A slow frame rate spoils everything. The user noticed slowness before anything else.
   - *Evidence:* "running very slow" led to the frame-rate readout, the trails shader built from what's drawing, and the resolution that follows the frame rate.
7. **Legible.** The user should be able to tell what's on screen and why, and see anything on its own.
   - *Evidence:* confusion about "lots of other stuff imposed over" the cosmos led to the panel's On screen line, Solo, and the Cosmos preset.

## Open questions

These are things to learn from 👍 / 👎, not to assume:
- Which worlds and scenes hold up over a whole set, and which tire?
- How often should the cosmos change system? How close should the camera fly, and how fast?
- Is the kaleidoscope liked at all now, and in which sections?
- Centrepieces (skull, unicorn, maths shapes): welcome in about 30% of sections, or less?
- Calm sections: still and spacious, or do they feel empty?

## Log

The newest entries go at the bottom: the date, what was learned, from what, and what changed.

- 2026-09-26: seeded from the feedback so far (principles 1–7).
