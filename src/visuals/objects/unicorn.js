// Wire unicorn: a prancing unicorn of glass panes (mesh from tools/unicorn-mesh.mjs), one foreleg raised, with a flowing tail
// and a spiral horn. Its head nods on the pulse; its eyes glow on the downbeat. Everything else comes from mesh-object.js.
import { meshObject } from './mesh-object.js';
import UNICORN from './meshes/unicorn.js';

export default meshObject({key: 'unicorn', label: 'Wire unicorn', words: 'The wire unicorn is the centrepiece',
  mesh: {pieces: [UNICORN.body, {...UNICORN.head, hinge: true}], hinge: UNICORN.hinge},
  dance: {moves: {groove: 2.2, bang: .6, look: 1, face: .8, float: 1, pulse: .5, lift: .6, approach: .8, rise: .6}, sym: 4, liftPart: 5}});   // a prancer; the horn lifts off
