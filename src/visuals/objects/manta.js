// Manta ray: the first object modelled in Blender (tools/blender/manta.py, imported by tools/import-glb.mjs). It glides
// rather than spins, centred: tipped towards us so its back shows, its wings beating in step with the bar (the model's
// "Flap" shape key, played both ways) and further as the tension rises. Its dance is slow and symmetric: it comes towards
// us over a phrase and goes back, or tips back to show its belly and down again (the user found its banking and bobbing
// "janky"). Its eyes glow on the downbeat. Everything else (arriving, shattering, the band of light,
// sparks on stabs) comes from mesh-object.js.
import { meshObject } from './mesh-object.js';
import { S } from '../../state.js';
import { SIG } from '../../scene/signals.js';
import { TUNE } from '../../tuning.js';
import MANTA from './meshes/manta.js';

const st = {ph: 0};
export default meshObject({key: 'manta', label: 'Manta ray', words: 'A manta ray glides, its wings beating with the music',
  mesh: {pieces: [MANTA], hinge: [0, 0, 0]},
  dance: {moves: {approach: 2.5, rise: 2.5, float: 1.2, still: .8, spin: .15, look: .2, lift: .2, face: 0, bang: 0, groove: 0, pulse: 0}, liftPart: 4,
    approach: .55, rise: 1.9},   // it comes towards us, and tips back to show its belly
  motion(U, P, x){
    const T = TUNE.manta, per = T.beatsPerFlap/4;
    // the wingbeat: in step with the bar while the beat grid holds it, running on at the beat's pace while it doesn't
    if (SIG.barPhase > 0) st.ph = (SIG.barPhase/per) % 1;
    else st.ph = (st.ph + x.dt/(Math.max(.25, S.beatPeriod)*T.beatsPerFlap)) % 1;
    const beat = Math.sin(st.ph*Math.PI*2), J = x.J;
    U.morph = beat*T.flap*(.6 + .4*(J ? J.tension : .5));
    U.rot = Math.sin(x.t*.07)*T.turn;   // (a slow, slight turn: it faces us)
    U.pitch = T.pitch;
  },
});
