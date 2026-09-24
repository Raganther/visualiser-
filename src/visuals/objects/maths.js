// Wire maths shapes: a geodesic sphere, a torus, a torus knot, a dodecahedron and a spiky star, worked out in
// meshes/maths.js. Five visuals from one module (the registry spreads them); each behaves like every mesh object.
import { meshObject } from './mesh-object.js';
import { dodeca, knot, sphere, star, torus } from './meshes/maths.js';

export default [
  meshObject({key: 'geosphere', label: 'Wire sphere', words: 'A geodesic sphere is the centrepiece', mesh: sphere()}),
  meshObject({key: 'torus', label: 'Wire torus', words: 'A torus is the centrepiece', mesh: torus()}),
  meshObject({key: 'knot', label: 'Wire knot', words: 'A torus knot is the centrepiece', mesh: knot()}),
  meshObject({key: 'dodeca', label: 'Wire dodecahedron', words: 'A dodecahedron is the centrepiece', mesh: dodeca()}),
  meshObject({key: 'spikes', label: 'Wire star', words: 'A spiky star is the centrepiece', mesh: star()}),
];
