// Jellyfish: modelled in Blender (tools/blender/jelly.py). A scalloped bell with four horseshoe gonads showing through it,
// frilly oral arms and twelve trailing tentacles. It swims to the beat: the bell contracts on the kick (the model's "Pulse"
// shape key) and relaxes wide before the next, harder as the tension rises, and it lifts a little with each stroke. It
// turns slowly, centred; its sense spots round the rim glow on the downbeat. The rest comes from mesh-object.js.
import { meshObject } from './mesh-object.js';
import { S } from '../../state.js';
import { SIG } from '../../scene/signals.js';
import { TUNE } from '../../tuning.js';
import JELLY from './meshes/jelly.js';

const st = {ph: 0, lift: 0};
export default meshObject({key: 'jelly', label: 'Jellyfish', words: 'A jellyfish swims to the beat',
  mesh: {pieces: [JELLY], hinge: [0, 0, 0]},
  dance: {moves: {float: 2, still: 1, rise: 1.2, approach: 1.2, spin: .5, look: .3, face: .3, bang: 0, groove: 0, pulse: .6, lift: .2}, sym: 8, liftPart: 3},   // it drifts and rises; the arms lift away
  motion(U, P, x){
    const T = TUNE.jelly, J = x.J, per = T.beatsPerStroke;
    // one stroke every per beats, in step with the beat grid while it holds (running on at the beat's pace while it doesn't)
    if (SIG.barPhase > 0) st.ph = ((SIG.barPhase*4) % per)/per;
    else st.ph = (st.ph + x.dt/(Math.max(.25, S.beatPeriod)*per)) % 1;
    const snap = Math.exp(-st.ph*T.snap), ease = st.ph;   // contracting at once on the beat, relaxing through the rest of it
    const amt = .6 + .4*(J ? J.tension : .5);
    U.morph = (snap*1.25 - .35 - .25*ease)*amt;
    st.lift += ((snap - .3)*T.lift - st.lift)*Math.min(1, x.dt*4);   // a little lift with each stroke
    U.pos = [U.pos[0], U.pos[1] + st.lift];   // (a copy: it can be a world's anchor)
    U.rot = x.t*T.turn;
    U.pitch = T.pitch;
  },
});
