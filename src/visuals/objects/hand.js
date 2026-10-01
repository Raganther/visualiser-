// The hand: a right hand sculpted round a skeleton and rendered in Blender (tools/blender/hand.py), baked for real time,
// under the lit objects' moving lights (lit-object.js). Its shape key clenches it (the fingers curled by their bones):
// relaxed and a little spread at rest, it grips on each kick (harder when the music is intense), and a drop flings it open.
import { TUNE } from '../../tuning.js';
import { litObject } from './lit-object.js';
import A from './meshes/hand-lit.js';

export default litObject({key: 'hand', label: 'Hand', words: 'A hand grips to the beat', asset: A,
  dance: {moves: {look: 1.4, float: 1, still: 1, approach: 1.2, pulse: 1, groove: .6, bang: .6, face: .4, spin: .2, rise: .4, lift: 0}, sym: 2, reach: true, liftPart: 0},
  beat(pos, st){ st.k = 1; },   // its own grip on each beat, letting go over the beat (the pulse, P.beat, is too gentle for a fist)
  motion(U, P, x, st){
    const T = TUNE.hand, ten = (x.J && x.J.tension) || 0;
    st.k = (st.k || 0)*Math.exp(-x.dt*T.release);
    const want = T.rest + st.k*T.grip*(.5 + .6*ten) - st.drop*T.spread;
    st.g = (st.g ?? T.rest) + (Math.max(-.35, Math.min(1, want)) - (st.g ?? T.rest))*Math.min(1, x.dt*14);
    U.morph = st.g;
  },
});
