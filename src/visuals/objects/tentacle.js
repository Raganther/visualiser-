// The tentacle: an octopus's arm sculpted and rendered in Blender (tools/blender/tentacle.py), baked for real time, under
// the lit objects' moving lights (lit-object.js). It writhes: bent at nine joints up its length (render/lit.js), a wave
// running up it faster as the music builds, swelling with the bass; each kick flexes it, and a drop curls it over.
import { TUNE } from '../../tuning.js';
import { litObject } from './lit-object.js';
import A from './meshes/tentacle-lit.js';

const z = new Array(9).fill(0), xs = new Array(9).fill(0);
export default litObject({key: 'tentacle', label: 'Tentacle', words: 'An octopus arm writhes to the music', asset: A, bend: true,
  dance: {moves: {look: 1.4, float: 1.4, still: 1, approach: 1, pulse: .8, groove: .5, bang: .2, face: .3, spin: .2, rise: .3, lift: 0}, sym: 2, reach: true, liftPart: 0},
  motion(U, P, x, st){
    const T = TUNE.tentacle, ten = (x.J && x.J.tension) || 0;
    st.ph = (st.ph || 0) + x.dt*T.waveSpeed*(.5 + ten);
    const amp = T.wave + T.bass*(P.bass || 0)*x.react, curl = T.curl*st.drop;
    for (let j = 0; j < 9; j++) {
      const up = (j + 1)/9;
      z[j] = amp*Math.sin(st.ph - j*T.waveLen) - curl*up**1.5 - T.kick*P.beat*up;
      xs[j] = amp*.6*Math.cos(st.ph*.8 - j*T.waveLen + 1);
    }
    U.bend = {z, x: xs};
  },
});
