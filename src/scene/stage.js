// The room the Prism stands in (docs/prism-plan.md, stage 7): what the Prism works out each frame for the room world to draw
// (worlds/room.js), in the view space of the facet engine's camera (render/facet.js: the camera at (0, 0, cam) looking down
// -z, the Prism round the origin; on screen, x = pos + X·f/(cam − z), f the focal length in screen heights). A leaf module.
// - lamps: up to three, each where it is (view space), its colour, how bright, where on screen, and the cone's width;
// - spots: the lamps' light thrown off the facets onto the floor and the walls, a mirror ball's (screen x, y, size, bright);
// - rain: how much rain falls through the beams (the rain layer in 3D);
// - the floor below (its tilt: how far the camera looks down), and the Prism's shadow on it.
export const MAXSPOTS = 24;
export const STAGE = {
  on: 0, rain: 0, t: 0, cam: 3.2, f: 1.3, pos: [0, 0], tilt: .25, floor: .62, haze: .5, hue: 0,
  lamps: [0, 1, 2, 3, 4, 5].map(() => ({p: [0, 1, 1], c: [1, 1, 1], k: 0, s: [0, 0], cone: .35})),   // (3 to 5: the orbits' lights, stage 10)
  spots: new Float32Array(MAXSPOTS*4), spotC: new Float32Array(MAXSPOTS*3), nSpots: 0,
  shadow: [0, 0, 0],   // where on the floor (x, z in the floor's own frame) and how dark
  caus: new Float32Array(8*4), causC: new Float32Array(8*3), nCaus: 0,   // caustics: light through the glass landing as rainbow patches (screen x, y, size; colour)
  MAXB: 24, beams: new Float32Array(24*4), beamC: new Float32Array(24*4), nBeams: 0,   // the lasers behind the Prism (screen x0 y0 x1 y1; colour, width), for the room to draw
};
