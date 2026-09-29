# Ideas

The backlog for Afterglow: things to build, in order. The user curates it. Move items, add them, strike them out. A scheduled builder (see the `next-idea` skill) takes the **top unclaimed item** each run, builds it on its own branch, and opens a pull request for the user to look at. Each run takes one item and never merges.

Each item is a short brief: what it is, why (the user's words when there are some), and anything it must not do.

## Overnight (2026-09-28, the user asleep; Claude builds these in order, merging each batch once tests pass)

Batches 1–3 are built (and the mood ring and set arc from the later list); batch 4 is the forest, rain and constellations.

Batch 1: new places.
1. **The night sea** (a world). A dark ocean under the moon, the moon wearing a ring of light (a halo, as on a frosty night), waves swelling with the bass, a path of moonlight glittering on the water, a lighthouse's beams sweeping on the bar. Its front plane is the nearest swell, so glow can sit between the waves.
2. **Underwater** (a world). Light from above in shifting caustics, god rays, drifting motes and bubbles rising on the hats, the surface's silver ceiling rippling, deep blue fading to black.
3. **Dunes under the stars** (a world). Rolling sand ridges in moonlight, a clear sky full of stars and the Milky Way's band, wind lifting sand off the crests on the hats.

Batch 2: new layers.
4. **Fireflies** (bokeh): soft out-of-focus lights drifting and blinking, brighter with the hats; atmosphere for calm parts.
5. **Stargate**: rings of light rushing towards you, one on each kick, faster in a build.
6. **Vectorscope**: the left channel against the right, drawn as a glowing figure (the new stereo reading), closed loops for tones and clouds for noise.
7. **Mandala**: a sacred-geometry figure that draws itself line by line over each phrase and turns with the bar.

Batch 3: hits and finish.
8. **Lightning** (a hit): a forked bolt on stabs, lighting the scene for a moment.
9. **Glitch** (a hit): the picture slices and shifts sideways for a few frames on a drop.
10. **Film grain and VHS** (a finish option): grain, a little chromatic fringing and scan lines, for a warmer, older look.

Batch 4: more places and weather (built).
11. **The glowing forest** (a world): trunks fading into a glowing mist, moonbeams, bioluminescent caps pulsing on the beat.
12. **Rain** (a layer): streaks thickening with the hats and noise, blown by the wind, splashing on the kick.
13. **Constellations** (a layer): a figure joined a line a beat, a new one every few bars.

Later, bigger (after tonight):
- ~~A mood ring~~ (built: the `mood` layer). ~~A set arc~~ (built: the panel's "Set arc").
- Record a moment: a short clip of a liked moment to save.
- MIDI controller input for the sliders.

## Up next

1. **A nebula to fly into.** A vast lit gas cloud as its own place in the cosmos: flying in, the stars inside it lighting the gas from within, dark lanes of dust. It suits calm, spacious music. (Taste: atmosphere, places to explore.)
2. **Comets that orbit in 3D in the cosmos.** The Orbits layer circles on screen. These would be real bodies round a planet in the cosmos's own space, with tails pointing away from the star.
3. **A city you can fly down into.** Land on a night-side city: streets of light in a grid, towers rising past the camera, the neon from the city world. It suits driving, intense music.
4. **Rings you can fly through.** A ringed gas giant's rings up close: ice and rock in bands, like the belt, with the planet filling the sky.
5. **Weather on the ground.** Rain or snow, and lightning on the hi-hats, while landed. The sky closes in on a build, and a drop clears it.
6. **The terrain's detail from a texture.** Bake each landed world's height into a texture once, so the ground can have more detail for the same cost. (Speed.)

## Waiting on the user

- **Which devices they watch on**, to set how much terrain detail is affordable.
- **When the scheduled builder should run** (days, time zone), and whether they want notifications.

## Done

The history is in `git log` and the plans in `docs/`.
