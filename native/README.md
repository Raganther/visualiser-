# The Prism, native

`PrismTest.swiftpm` is a small iPad (and iPhone) app in Swift and Metal. It tests how the Prism feels when it's built natively instead of in the browser. It has:
- the Prism alone in the void;
- your own tracks, read ahead before they play;
- Jam;
- nothing else from Afterglow.

## Run it

**On the iPad (Swift Playgrounds 4.4 or later, free):**
1. Get the `PrismTest.swiftpm` folder into Files. Either save the zip Claude sent and tap it to unzip it, or download the repository's zip from GitHub and unzip it.
2. Tap `PrismTest.swiftpm`. It opens in Swift Playgrounds.
3. Press ▶ Run.

**On a Mac (Xcode 15 or later):**
1. Open the `PrismTest.swiftpm` folder in Xcode.
2. Choose your iPad or a simulator, and Run. On a real device, sign with your personal team: Signing & Capabilities.

Neither compiles here, in Claude's cloud container: it has no Swift toolchain or Metal. If the first build stops with errors, paste them to Claude.

## What it does

- **Music:**
  - **＋ Music** takes a track from Files. It's read whole first ("Reading ahead…"): its tempo, where every beat falls, how hard the kick is on each, the stabs and hats, the bass, the tension, the breakdowns and the drops.
  - **Demo beat** plays sixteen bars of minimal techno at 124 BPM, made in the app, with a breakdown and a drop, looped.
  - The picture follows the track as it's heard at the speakers, the output delay taken off.
- **The Prism:**
  - An icosahedron of 20 to 1,280 facets that gains facets with a steady groove and as the music builds. New ones bloom out from the middle.
  - It tours named shapes, one each phrase: ball, cube, octahedron, diamond, star, disc, pill, flower, starfish, urchin, shell, cushion, jewel, lantern, spindle and twisted cube.
- **How it reacts:**
  - The kick sends rings of light across the facets (only the 1 when calm).
  - Stabs step a lit wedge round it, and the hats light a few facets at random.
  - Through a drop's run-up it fills with light from the bottom. On the drop it shatters and comes back as a sharp shape.
  - The bass swells it.
- **Music without a steady beat** (a band playing freely): it moves less and more slowly, gets a new shape every 16 s instead of every phrase, its swells are no longer drops, and its hits make soft rings.
- **The look:**
  - Glass facets lit by a warm key light drifting in front, a cool rim light behind and a low fill in the palette's colour.
  - The glint is split into a rainbow (the fire), and every facet has glowing edges.
  - A glow is added at half size and the brightest parts roll off softly.
- **Jam:**
  - Drag beside it to turn it; it spins on and slows.
  - Press on it and drag outward to pull out spikes at five symmetric points; drag inward, or hold, for dents. They spring back at the beat's speed when let go.
  - Tap it to send a ring of light from there.
  - Pinch to come closer.
- **The bar:** Play / Pause, **New shape**, **Drop** (now), **Facets** (auto, or held at 20, 80, 320 or 1,280), **Hide** (… brings it back). The status line shows:
  - the track, its tempo or "free time", "breakdown" or "the drop is coming";
  - the shape, the facets, the activity and the frame rate.

## Files

| File | What's in it |
|---|---|
| `Package.swift` | The app's manifest (Swift Playgrounds' app format) |
| `App.swift`, `ContentView.swift` | The screen, the bar, touch and pinch |
| `Geometry.swift` | The facet geometry, ported from `src/render/facet.js` |
| `Prism.swift` | The brain: shapes, music, light, Jam. Its feel numbers are in `Tune` |
| `Renderer.swift` | Metal: the facets' shaders (compiled from source at launch, as Swift Playgrounds can't build `.metal` files), the glow, the finish |
| `Analysis.swift` | The track read ahead (vDSP) |
| `Player.swift` | Playback (AVAudioEngine), the time as heard, and the demo beat |

The steady-beat threshold (`conf > 3.5` in `Analysis.swift`) was set on synthetic music: techno scored 8 to 13, and music played freely about 2. Real tracks may want it moved.

## The same test in WebGL

`prism-web.html` is the same test ported line for line to the browser: the same geometry, brain, track reading, lights, shaders and finish, in WebGL 2. It's published at https://claude.ai/artifact/741JxUbdFxzgAgrrH8SWQy, so the two can be compared on the same iPad. It draws at the screen's full resolution, up to 3× (`devicePixelRatio`), as the app does.

