# Night log

## Morning summary (2026-10-01)

Published as versions 55–62 of https://claude.ai/artifact/RVGKQgxeH9VnoQBLXorKYJ. To try each, pick its preset (or, with
Journey on, press W and the world's number to keep it):
- **Four new 3D worlds**, each joining Journey's worlds:
  - **The Cathedral**: an endless hall church of columns and rib vaults, stained glass pulsing on the kick, altars;
  - **The Vessel**: a flight along an artery, red cells tumbling past, the walls swelling on the kick;
  - **The Geode**: a winding fissure carpeted with crystals that grow through a build and flash white on a drop;
  - **The Corridor**: an endless hall of neon frames over a black mirror floor, the kick's light rushing down it, a
    strobe on the drop (made for minimal techno).
- **Objects inside the worlds:** every 3D world has places where the centrepiece stands (the Hollow's chambers, the
  Cathedral's altars, the Geode's caverns, spots in the Vessel and the Corridor), with the near walls, pillars, crystals
  and cells passing in front of it.
- **Particles and layers in the worlds:** spores, dust and glitter drift through the worlds; the glowing layers are laid
  on their walls (and reflected in the Corridor's floor).
- **Reaching out:** on a drop, the hand, tentacle, goblins and skull turn to face you and lunge towards you.
- **Journey uses the lit objects** (goblin, tentacle, hand, heart) as centrepieces now, often in neon.
- **Fixed:** the lasers' crossing pattern was off the screen (two dark bars); the Geode's dust made dark specks with loud
  hats; the Vessel's simple-mode front covered the whole picture; the Cathedral was never chosen by Journey.
- **Worth your eyes:** the Corridor and the Geode with a real set; whether Journey now brings in too many objects (a
  centrepiece in about a quarter of sections, a lit one in about a quarter of those); the objects test's "beats its
  wings" check fails for four objects (lotus, goblin, goblinLit, hand), as it did before tonight.

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
5. ~~**A new world: the geode:**~~ (done 01:50) a crystal cavity, spikes lit from inside, refracting, cracking open on a drop.
6. ~~**Reaching out:**~~ (done 01:50) a move in which an object turns to face us and comes towards us on a drop (the user loved the hand and
   tentacle "reaching out towards you").
7. ~~**Journey and the lit objects:**~~ (done 03:20) let Journey cast a lit object as a centrepiece now and then, placed in the worlds.
8. ~~**A new world for the club: the Corridor:**~~ (done 04:35, version 61) an endless hall of neon frames (arches, squares, hexagons by section) the
   camera flies through, each frame lighting as the kick passes it, a mirror floor doubling them, strobes on a drop:
   the most techno of the worlds, and cheap to draw (added at 03:20: the plan was done, and the user's music is
   minimal techno).
9. ~~**The Geode's drop:**~~ (done 05:10) the crystals flash white from the cavern outward and shed glinting shards (the dust bursts).
10. ~~**The worlds in the lit objects' looks:**~~ (done 05:10: the Vessel had no place for an object, and its simple-mode front covered everything; both fixed) Journey's neon hand in the Corridor or the Geode reads well; check each 3D
   world with a lit object for placement and lighting, and fix any that float wrongly.
11. ~~**The layers in the newer worlds:**~~ (done 05:40) the glowing layers laid on the Vessel's walls (as on the Hollow's rock) and
   reflected in the Corridor's black mirror floor, so the layers belong to those places too.

## Log
- 22:05 UTC: published version 55: the Hollow's honeycomb back (every section the gyroid; gentler swoops), the Cathedral (a new world: preset "The Cathedral", or W then its number), the hand rebaked (nails at the fingertips). Tests for the new world (Journey, visuals, golden) running.
- 23:40 UTC: version 56: objects inside the 3D worlds. The Cathedral sets an altar in a side aisle every 8 bars (and at each new section), where the centrepiece stands, lit, seen past the columns; the Hollow's chambers hold it too; in both, the walls, pillars and columns nearer than the object pass in front of it (the world's front plane drawn only as deep as the object). To see it: the Cathedral or the Hollow, plus an object (O then its number), and wait for an altar or a chamber. Also: the Cathedral's Journey score fixed (it was NaN: never chosen), the golden tests re-recorded for the new world.
- 00:05 UTC: version 57: particles in the 3D worlds: spores rising through the Hollow's lamp light, dust gathered in the Cathedral's columns of light under the oculi; real 3D points along each view ray (walls hide the ones behind them), the near ones soft and bigger like lights out of focus, twinkling, livelier with the hi-hats, bursting on a drop. Simple mode streams dots past. To see it: either world.
- 00:40 UTC: version 58: the glowing layers' picture laid on the 3D worlds' walls, stuck to them: wrapped round the Hollow's tunnel like a sleeve, laid on the Cathedral's floor, vaults and columns, so the neon slides past as the camera flies (WebGL; subtle, an echo, not a second layer). To see it: either world with a layer on (Into the Hollow has the flow field).
- **01:05, the Vessel (version 59).** A new 3D world: a flight along an artery, wet ribbed walls with glowing veins, side
  branches, red cells tumbling past; each kick swells the walls and surges the flow, a drop floods it with light. Each
  section is its own vessel (artery, vein, lymph, nerve with sparks). It joined Journey's worlds (golden re-recorded). To see
  it: the "The Vessel" preset, or W and its number.
- **03:55, version 60.** (1) The Geode, a new 3D world: a winding fissure carpeted with crystal points (amethyst, citrine,
  quartz or emerald by section), milky at the base and glowing at the tip, over agate-banded rock, opening into caverns
  where the crystals grow huge; they lengthen through a build, a wave of light runs through them on the kick, glinting
  dust hangs in the air; an object stands in each cavern. See it: the "The Geode" preset, or W and its number.
  (2) Reaching out: on a drop the hand, tentacle, goblins and skull turn face-on and lunge towards you, hold, and ease
  back (see it: the "Hand" or "Tentacle" preset, and wait for a drop). (3) Journey now casts the lit objects (goblin,
  tentacle, hand, heart) as centrepieces, often in neon. (4) Fixed: the lasers' "crossing" pattern leaned off the screen
  (two bars of nothing); now the beams cross from the corners.
- **04:35, version 61.** The Corridor, a new 3D world for the techno: an endless hall of neon frames (arches, squares,
  hexagons or rings by section, in the palette's colours) flown through in the dark over a black mirror floor that
  doubles them; each kick sends a wave of light rushing away down the hall, every fourth frame burns brighter, a drop
  strobes it. An object stands in the hall every so often. See it: the "The Corridor" preset, or W and its number.
- **06:40, version 62.** The Geode's drop (a white flash racing out through the crystals, the dust bursting; dark
  specks from the dust fixed); an object floats in the Vessel with the cells passing in front of it (and its simple-mode
  front no longer covers the picture); the glowing layers on the Vessel's walls and in the Corridor's mirror floor. The
  plan is done: the night shift Routine is disabled.
