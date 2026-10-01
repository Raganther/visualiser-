# Night log

The user went to bed on 2026-09-30 and asked Claude to keep iterating on its own through the night: more worlds, more
layers, new ways of combining them, graphical layers and particles in the new 3D worlds, objects placed in worlds, "anything
at all". An hourly wake-up (a Routine firing into the session) carries the work on; each wake-up takes the top open item,
builds it, checks it in both renderers, commits, pushes and republishes, and logs it here. The Routine: "Afterglow night
shift" (`trig_01Nk7Vu1JeHQyBVm4EajSRCd`), hourly from 23:04 UTC, disabled by the last wake-up after 07:30 UTC.

Rules for each wake-up:
- One item per wake-up, finished and checked (both renderers, no page errors, a still or a strip looked at) before the
  next; the smoke test on the bundle before every publish; the page must never be left broken.
- Read `docs/taste.md` first. Few things at once; the user loves depth, the Hollow's honeycomb, the tentacle, neon, and
  things reaching out towards them; they disliked the Hollow losing its honeycomb ("an asteroid belt").
- Never change a behaviour the user liked without logging why; never skip or weaken a test.
- A world or layer added to Journey changes the golden test's recording: re-record it (`npm run golden:update`) only for
  that reason, and say so in the commit.

## Plan (top first)

1. ~~**Objects truly inside the worlds:**~~ (done 23:40) the 3D worlds hand their depth to the objects, so the Hollow's pillars and the
   Cathedral's columns pass in front of a centrepiece; the Cathedral gets an altar (a place ahead in the nave where the
   centrepiece stands, as the Hollow's chambers do).
2. ~~**Particles in the worlds:**~~ (done 00:05) drifting spores lit by the Hollow's lamp, dust in the Cathedral's shafts of light, both
   moving with the camera's flight, livelier with the hi-hats, bursting on a drop.
3. ~~**Layers on the walls:**~~ (done 00:40) the glowing layers' picture wrapped onto the Hollow's rock and the Cathedral's stone, so the
   neon runs along the walls rather than floating over the picture.
4. ~~**A new world: inside the body:**~~ (done 01:05, version 59) a flight along an artery, red cells tumbling past, the walls pulsing with the kick,
   branching vessels; the heart could stand where they meet.
5. **A new world: the geode:** a crystal cavity, spikes lit from inside, refracting, cracking open on a drop.
6. **Reaching out:** a move in which an object turns to face us and comes towards us on a drop (the user loved the hand and
   tentacle "reaching out towards you").
7. **Journey and the lit objects:** let Journey cast a lit object as a centrepiece now and then, placed in the worlds.

## Log
- 22:05 UTC: published version 55: the Hollow's honeycomb back (every section the gyroid; gentler swoops), the Cathedral (a new world: preset "The Cathedral", or W then its number), the hand rebaked (nails at the fingertips). Tests for the new world (Journey, visuals, golden) running.
- 23:40 UTC: version 56: objects inside the 3D worlds. The Cathedral sets an altar in a side aisle every 8 bars (and at each new section), where the centrepiece stands, lit, seen past the columns; the Hollow's chambers hold it too; in both, the walls, pillars and columns nearer than the object pass in front of it (the world's front plane drawn only as deep as the object). To see it: the Cathedral or the Hollow, plus an object (O then its number), and wait for an altar or a chamber. Also: the Cathedral's Journey score fixed (it was NaN: never chosen), the golden tests re-recorded for the new world.
- 00:05 UTC: version 57: particles in the 3D worlds: spores rising through the Hollow's lamp light, dust gathered in the Cathedral's columns of light under the oculi; real 3D points along each view ray (walls hide the ones behind them), the near ones soft and bigger like lights out of focus, twinkling, livelier with the hi-hats, bursting on a drop. Simple mode streams dots past. To see it: either world.
- 00:40 UTC: version 58: the glowing layers' picture laid on the 3D worlds' walls, stuck to them: wrapped round the Hollow's tunnel like a sleeve, laid on the Cathedral's floor, vaults and columns, so the neon slides past as the camera flies (WebGL; subtle, an echo, not a second layer). To see it: either world with a layer on (Into the Hollow has the flow field).
- **01:05, the Vessel (version 59).** A new 3D world: a flight along an artery, wet ribbed walls with glowing veins, side
  branches, red cells tumbling past; each kick swells the walls and surges the flow, a drop floods it with light. Each
  section is its own vessel (artery, vein, lymph, nerve with sparks). It joined Journey's worlds (golden re-recorded). To see
  it: the "The Vessel" preset, or W and its number.
