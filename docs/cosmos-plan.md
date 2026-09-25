# The cosmos: plan and log

The cosmos (`visuals/worlds/cosmos/`, camera in `scene/camera.js`) began as a lab: generated star systems a camera
explores, shots picked by the music. This plan grows it in three parts, each landing green (`npm test`, commit, push,
`test:dist`, republish, PR note). Tick items as they land; the log at the end says what changed and why.

## Part 1: the camera follows the track's shape
- [x] **Builds and drops.** Rising tension pulls the camera toward a body (closer as the build grows, the view narrowing,
      the stars starting to stretch); the drop releases it: a hyperspace jump, or a sudden pull back to the whole system.
      Breakdowns (no kick for a while) drift or circle wide and slow.
- [x] **A section's sound picks its place.** Each system has a mood (how hot or cold): calm sections get ice worlds and
      pale stars, driving ones gas giants, intense ones lava worlds and big deep-coloured stars (binaries and black holes
      come with part 2).
- [x] **A track becomes a map.** The track's name seeds its galaxy; each new section takes the next system on the arm
      that matches its mood, so the same track takes the same journey and alike sections are neighbours.
- [x] **The layers join the space.** The camera's movement becomes wind and zoom for the trails, comets and flow, so the
      glow streams past as the camera flies. (Anchoring the centrepiece in space moved to part 2, with the monument.)
- [x] **Journey picks the cosmos as a world** (no lab needed), and narrates what the camera is doing (a caption, and the
      panel). The lab stays for flying it by hand.

## Part 2: more to discover
- [x] **Asteroid belts** to fly through: rocks rushing past up close (a `belt` shot).
- [x] **Set pieces:** a black hole bending the starlight, with a glowing disk (for the biggest drops); pulsars whose
      beams sweep on the beat; binary stars.
- [x] **Livelier planets:** storms in gas giants with lightning on the hi-hats, city lights on night sides, auroras
      pulsing on the kick, ocean worlds catching the star's glint, lava flaring on stabs.
- [x] **Built things:** a giant ring structure round some stars; the centrepiece (the skull, the unicorn, the maths
      shapes) as a vast monument in orbit.

## Part 3: from the galaxy to the surface
- [x] **The galaxy view.** The systems are points on a spiral galaxy's arms (by mood); a big drop can pull all the way
      out to it and dive back into another system.
- [x] **Skimming a surface.** A low-orbit shot racing over a planet's curved horizon, its surface gaining detail up close.

## Log
- **Part 1.** The cosmos moved into its own folder (`system`, `fly`, `look`, `draw2d`, `index`) and became one of Journey's
  worlds (its share over 400 sections is like the others'). A build is the tension's quick average pulling ahead of its
  slow one; the `push` shot's distance follows the build's progress, so the camera closes in as fast as the music climbs
  (15-25 s for a full build). The first section owns the system the camera starts in, which fixed returning sections
  having nowhere to return to. Two bugs found on the way: the tension averages started at 0, so every track opened with
  a false build (they now start level); and a build moved in about 10 s, too fast for techno's long builds. Golden was
  re-recorded: Journey's world pool grew.
- **Parts 2 and 3** (drafted in a copy while part 1's tests ran, then applied together). Stars can be twin, a pulsar or a
  black hole (by arm); planets carry cities, auroras, storms and clouds, and ocean worlds join the kinds; belts sit in
  gaps; a ring is sometimes built round the star; the centrepiece stands as a monument (`P.anchor`, read by the mesh
  objects). The black hole looks the sky up along a bent ray and draws its disk twice (straight, and the far side bent
  over the top). The belt's rocks come from a grid the ray steps through (28 cells at most), so any number of rocks costs
  the same. The galaxy is its own view, faded in over the system (`uGal`), with its own camera; the biggest drops can go
  out to it. Skimming lets the camera within 3% of the surface. Two things found on the way: the music kept taking the
  camera back from shots picked by hand (now a shot by hand holds it for `handSecs`), and the first draft's tests were
  too weak to notice (they now check where the camera actually is).
