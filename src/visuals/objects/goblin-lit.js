// The goblin, lit: the Blender sculpt (tools/blender/goblin_hd.py) baked for real time (about 47k triangles, its wrinkles,
// warts and pores in a normal map, its mottled skin and the creases' shade in a colour map), under the lit objects' moving
// lights (lit-object.js): the key's shadow (the nose's) sweeps across the face, the ears glow red when the rim light
// passes behind them. It snarls with the music (the sculpt's shape key), as the wire goblin does.
import { TUNE } from '../../tuning.js';
import { litObject } from './lit-object.js';
import A from './meshes/goblin-lit.js';

export default litObject({key: 'goblinLit', label: 'Goblin, lit', words: 'A lifelike goblin under moving lights', asset: A,
  dance: {moves: {bang: 1.2, look: 1.6, face: .6, pulse: .8, approach: 1.6, still: 1.2, groove: .3, float: .3, spin: .1, rise: .2, lift: 0}, sym: 4, liftPart: 0},
  motion(U, P, x, st){   // the snarl: a glower while it's quiet, the mids working the jaw, a full snarl on the downbeat when intense
    const G = TUNE.goblin, ten = (x.J && x.J.tension) || 0;
    st.hit *= Math.exp(-x.dt*G.snapDecay);
    const want = -G.glower + (P.mid*x.react*G.mids + st.hit*ten*G.snarl)*(.5 + ten);
    st.sn = (st.sn ?? -.5) + (Math.max(-.5, Math.min(1, want)) - (st.sn ?? -.5))*Math.min(1, x.dt*10);
    U.morph = st.sn;
  },
});
