// The heart: a human heart sculpted and rendered in Blender (tools/blender/heart.py), wet muscle, fat in its grooves,
// its coronary vessels branching over it, baked for real time, under the lit objects' moving lights (lit-object.js).
// It beats on the beat: its shape key squeezes it (the ventricles drawing in and up) and lets it fill again after.
import { TUNE } from '../../tuning.js';
import { litObject } from './lit-object.js';
import A from './meshes/heart-lit.js';

export default litObject({key: 'heart', label: 'Heart', words: 'A heart beats with the music', asset: A,
  dance: {moves: {pulse: 1.6, still: 1.2, float: 1, look: 1, approach: 1, groove: .4, bang: .3, face: .3, spin: .3, rise: .3, lift: 0}, sym: 2, liftPart: 0},
  beat(pos, st){ st.hb = 1; },
  motion(U, P, x, st){
    const T = TUNE.heart;
    st.hb = (st.hb || 0)*Math.exp(-x.dt*T.snap);
    U.morph = Math.min(1, st.hb*T.beat) - T.fill*(1 - st.hb);
  },
});
