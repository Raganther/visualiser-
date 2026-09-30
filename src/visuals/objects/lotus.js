// Lotus: a flower modelled in Blender (tools/blender/lotus.py), for the Indian mandala's world. Three rings of petals round a
// seed pod on a lily pad; it blooms and closes over each four-bar phrase (the model's "Open" shape key, played both ways:
// a bud at the phrase line, open wide half-way through), bursting fully open on a drop. It turns slowly and stays centred,
// tipped towards us so we look into it; its seeds glow on the downbeat. Arriving, shattering, the band of light and the
// sparks come from mesh-object.js.
import { meshObject } from './mesh-object.js';
import { SIG } from '../../scene/signals.js';
import { TUNE } from '../../tuning.js';
import LOTUS from './meshes/lotus.js';

const st = {ph: 0, burst: 0, drop: null};
export default meshObject({key: 'lotus', label: 'Lotus', words: 'A lotus opens and closes with the phrase',
  mesh: {pieces: [LOTUS], hinge: [0, 0, 0]},
  dance: {moves: {float: 1.6, still: 1.2, spin: .8, rise: 1.2, approach: 1, face: .6, look: .2, bang: 0, groove: 0, pulse: .4, lift: .3}, sym: 8, liftPart: 3},   // calm: it floats, turns by its petals, the inner ring lifts
  motion(U, P, x){
    const T = TUNE.lotus, J = x.J;
    // where in the four-bar phrase we are (running on at the beat's pace while there's no bar to count)
    if (J && SIG.barPhase > 0) st.ph = ((((J.bar - J.phraseAnchor) % 4) + 4) % 4 + SIG.barPhase)/4;
    else st.ph = (st.ph + x.dt/16) % 1;
    if (J && st.drop !== J.lastDrop) { if (st.drop !== null) st.burst = 1; st.drop = J.lastDrop; }   // a drop: it bursts open
    st.burst *= Math.exp(-x.dt/T.burstSecs);
    const bloom = -Math.cos(st.ph*Math.PI*2)*T.bloom;
    U.morph = bloom + (1 - bloom)*st.burst;
    U.rot = x.t*T.turn;
    U.pitch = T.pitch;
  },
});
