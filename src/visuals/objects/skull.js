// Wire skull: a low-poly skull of glass panes (mesh from tools/skull-mesh.mjs). Its jaw drops on the pulse, and its eye
// sockets and nose are dark holes; the sockets glow on the downbeat. Everything else comes from mesh-object.js.
import { meshObject } from './mesh-object.js';
import SKULL from './meshes/skull.js';

export default meshObject({key: 'skull', label: 'Wire skull', words: 'The wire skull is the centrepiece',
  mesh: {pieces: [SKULL.skull, {...SKULL.jaw, hinge: true}], hinge: SKULL.hinge},
  dance: {moves: {bang: 2.2, look: 1.5, face: 1, lunge: 1.3, groove: .8, sway: .6, lift: 1, spin: .6, float: .6}, sym: 4, liftPart: 1}});   // a head-banger; the cranium lifts off
