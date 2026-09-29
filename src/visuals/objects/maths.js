// Wire maths shapes: a geodesic sphere, a torus, a torus knot, a dodecahedron and a spiky star, worked out in
// meshes/maths.js. Five visuals from one module (the registry spreads them); each behaves like every mesh object, and
// dances by snapping round its own symmetry (a fifth of a turn for the dodecahedron, a third for the knot…).
import { meshObject } from './mesh-object.js';
import { dodeca, knot, sphere, star, torus } from './meshes/maths.js';

export default [
  meshObject({key: 'geosphere', label: 'Wire sphere', words: 'A geodesic sphere is the centrepiece', mesh: sphere(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 5, liftPart: 2}}),
  meshObject({key: 'torus', label: 'Wire torus', words: 'A torus is the centrepiece', mesh: torus(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 4, liftPart: 2}}),
  meshObject({key: 'knot', label: 'Wire knot', words: 'A torus knot is the centrepiece', mesh: knot(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 3, liftPart: 2}}),
  meshObject({key: 'dodeca', label: 'Wire dodecahedron', words: 'A dodecahedron is the centrepiece', mesh: dodeca(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 5, liftPart: 2}}),
  meshObject({key: 'spikes', label: 'Wire star', words: 'A spiky star is the centrepiece', mesh: star(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 6, liftPart: 2}}),
];
