# Speed audit (2026-09)

The user's laptop drew the landed cosmos at 13 fps, even at the auto resolution's lowest step (a 2106×1016 canvas at 50%,
1.5 ms of script a frame: the graphics chip was the cost). They asked for everything to run smoother **without the
graphics getting any worse**. So the rule for every change here: the picture stays the same (or differs by float
rounding), and anything that would change what's drawn is listed at the end, not done.

Four read-only reviews went through the cosmos shaders, the render pipeline, the other worlds' shaders, and the per-frame
JavaScript and simple mode. `tools/bench.mjs` measured each scene before and after, with a thumbnail per scene proving the
picture didn't move, and the golden test (thumbnails of a whole seeded run) checked the same.

## Results

Software WebGL (SwiftShader) at 320×180, milliseconds a frame, `main` before the audit against after; the picture column
is the largest change in any tile of each scene's thumbnail (of 255):

| Scene | Before | After | Speed | Picture |
|---|---|---|---|---|
| Journey's first sections | 417 | 252 | 1.65× | 0 |
| Kaleidoscope | 28.7 | 30.8 | about the same | 0 |
| City comets | 41.7 | 41 | about the same | 0 |
| Skull in the city | 68 | 61.8 | 1.1× | 0 |
| Northern lights | 32.5 | 33.3 | about the same | 0 |
| The cosmos from afar | 440 | 219 | 2.0× | 0 |
| A planet up close | 722 | 556 | 1.3× | 0 |
| The asteroid belt | 750 | 591 | 1.27× | 0 |
| Landed | 212–235 | 229–256 | about the same | 0 |

Timings in software rendering wander by about 10%, so the rows marked "about the same" are within that. Two cautions:
- **Software rendering runs four pixels at a time on the processor**, so a skip only pays when all four agree; a graphics
  chip runs 32 or 64 together, over areas that mostly agree (a building, the sky, a planet), so the skips should pay at
  least as well there. The city's and the landscape's gains (a pixel shades one building row or ridge, not up to four)
  don't show here for that reason.
- **The landed ground's cost is its march** (up to 80 steps of the height a pixel), which no exact change could shorten
  much; its savings are for rays that reach the sky, the valley floor and worlds without strata. What it gets instead is
  the adaptive size: on a slow device it steps down first, alone.

## Done

**Skipping work that can't show** (the same picture):
- **Front planes in their own segment.** When an object stands between a world's planes (the `among` template, the skull
  in the city, the monument among the cosmos's planets), the second segment worked out the whole world again, for every
  pixel, only to show it where the front covers. Now it works the world out only there.
- **The cosmos:** the far sky only where no star, planet or ring covers it; the planet surface routine called once instead
  of six inlined copies (and the cage the same); relief shading only on the day side; close-up detail only up close; city
  lights only on the night side; auroras only near the poles; the belt's rock clumping looked up only when a cell's own
  number leaves it in doubt; belt gas rejected for a whole view that never nears the ring, and per sample where there's
  no gas; the far belt's dust only inside its band; cloud, gas, dust and sky noise stopping once the octaves left can't lift
  it past its threshold (`czFt`).
- **The ground:** the valley floor (flat by construction) skips the mountains' noise, the sky only where there's no ground
  or sea, strata only on rock and basalt, nothing traced under a full whiteout. The haze over far ground reads the air alone
  (at the horizon the clouds and stars it skipped were all but gone: a difference below a level of brightness).
- **City, landscape:** the nearest building row, or ridge, covering a pixel hides the rest and the sky or sun behind, so
  they're tried near to far and only the first is shaded; the moon's craters only on the moon.
- **Aurora:** nothing below a curtain's foot; its rays only where they show.
- **Space:** stars only in the quarter of cells that hold one; the rings only across their ellipse.
- **Trails:** the second fold count's sample skipped when mirror is off (it read the same pixels); the fold itself too.
- **Shockwaves, comets, orbits:** spent rings, and pixels too far from a head, skipped.
- **The mirror tunnel:** its folding stops once a point is inside the triangle (it ran all 24 rounds).

**Smoothness:**
- **Frame pacing.** The 60 fps cap measured the time since the last frame, so on 75, 90 and 144 Hz screens it drew every
  other or third tick (37–48 fps), and the auto resolution took that for a slow device and lowered the picture. It now runs
  on a deadline: 60 a second on any screen.
- **Shaders without stalls.** Segment programs compile in the background and link when done; the same run with every
  world in it (warmed at idle) stands in meanwhile, drawing the same picture. The objects share one program, started at
  idle, and their vertex data is worked out at idle. (The "longest gap 84 ms" in the readout was most likely a compile.)
- **The heavy world first.** Landed, a slow device now draws the ground smaller before the whole picture, so the glow,
  hits and objects stay sharp; a fast one keeps it at full size. (For a few hours on 2026-09-28 the ground was always at
  half size; this replaces that.)
- **A like** encodes its thumbnail and saves after the frame, not in it.
- **The panel** writes its numbers, sliders, meter and accent colour only when they change.
- **Simple mode:** the water reflections read a copy of the picture above the water instead of the canvas itself (a canvas
  drawn onto itself is copied whole each time: 50–150 times a frame); a resolution step no longer wipes the trails when
  their size doesn't change.
- Small per-frame allocations reused (shockwave, comet and orbit arrays).

## Left, and why

These would change what's drawn, or cost more than they save:
- **Noise from a texture** (the ground's march, every `czN`): several times cheaper per step, but the mountains, clouds
  and gas would take different shapes. A good next step if the ground is still too slow, with the user's say.
- **Cheaper hashes** (the sine hash everywhere): the same, it would move every star, window and glint.
- **Redrawing the world every other frame**, or reusing the last frame (temporal upsampling): smoother on slow devices,
  but the world would move at half the rate, or smear on fast camera moves.
- **Lower precision** in the glow's passes (mediump): invisible on desktops, a saving only on phones; left for now.
- **Skipping the invisible halo of the star and outline hits** (under 1/255 far out): approximately the same, but not
  exactly; they're short-lived.
- **Simple mode's kaleidoscope** draws each folded layer in every wedge; culling to the wedge is possible but intricate,
  and only browsers without WebGL use simple mode.
- **Reusing the trails' parameters between groups** (a copy of P per group, per frame): a small saving, and visuals that
  read P's own keys would break.
- **Uniform-only colours worked out in JavaScript** (dozens of `hsv` calls per pixel across the shaders): a few percent,
  a lot of plumbing.
