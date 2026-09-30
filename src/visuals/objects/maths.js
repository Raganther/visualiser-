// Wire maths shapes: a geodesic sphere, a torus, a torus knot, a dodecahedron and a spiky star, worked out in
// meshes/maths.js. Five visuals from one module (the registry spreads them), and the crystal cluster (its own export, listed
// after the newer objects so the settings before it keep their places); each behaves like every mesh object, and
// dances by snapping round its own symmetry (a fifth of a turn for the dodecahedron, a third for the knot…).
import { meshObject } from './mesh-object.js';
import { crystal, dodeca, knot, sphere, star, torus } from './meshes/maths.js';

export default [
  meshObject({key: 'geosphere', label: 'Wire sphere', words: 'A geodesic sphere is the centrepiece', mesh: sphere(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 5, liftPart: 2}}),
  meshObject({key: 'torus', label: 'Wire torus', words: 'A torus is the centrepiece', mesh: torus(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 4, liftPart: 2}}),
  meshObject({key: 'knot', label: 'Wire knot', words: 'A torus knot is the centrepiece', mesh: knot(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 3, liftPart: 2}}),
  meshObject({key: 'dodeca', label: 'Wire dodecahedron', words: 'A dodecahedron is the centrepiece', mesh: dodeca(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 5, liftPart: 2}}),
  meshObject({key: 'spikes', label: 'Wire star', words: 'A spiky star is the centrepiece', mesh: star(), dance: {moves: {face: 3, spin: 1.2, groove: .8, pulse: .8, bang: .3, look: .2, lift: .6, float: .8, approach: 1, rise: .5}, sym: 6, liftPart: 2}}),
];
// a crystal cluster, turning by its sixths; a crystal lifts out of it
export const crystalObj = meshObject({key: 'crystal', label: 'Crystal cluster', words: 'A cluster of crystals is the centrepiece', mesh: crystal(),
  dance: {moves: {face: 2.5, spin: 1, float: 1.2, rise: 1, approach: 1, pulse: .8, lift: 1, still: .6, groove: .3, bang: .2, look: .3}, sym: 6, liftPart: 1}});
