// Goblin: a head sculpted in Blender (tools/blender/goblin.py): metaballs for the skull, heavy brow, sharp cheekbones,
// hooked nose and long pointed ears, the sockets and mouth carved out, wrinkled skin, crooked teeth, warts and eyes that
// glow on the downbeat. It snarls with the music (the model's "Snarl" shape key: the jaw drops, the nose wrinkles, the
// ears pin back): a glower while it's quiet, the mids working its jaw, a full snarl on each downbeat when the music is
// intense. The user asked for it to see how far the graphics can go. The rest comes from mesh-object.js.
import { meshObject } from './mesh-object.js';
import { TUNE } from '../../tuning.js';
import GOBLIN from './meshes/goblin.js';

const st = {sn: -.6, hit: 0};
export default meshObject({key: 'goblin', label: 'Goblin', words: 'A goblin glowers and snarls with the music',
  mesh: {pieces: [GOBLIN], hinge: [0, 0, 0]},
  dance: {moves: {bang: 1.6, look: 1.4, face: .8, pulse: 1, approach: 1.4, still: .8, groove: .4, float: .3, spin: .2, rise: .3, lift: .4}, sym: 4, liftPart: 2},   // it glares, head-bangs, leans in; the ears lift
  onBeat(pos){ if (pos === 0) st.hit = 1; },
  motion(U, P, x){
    const T = TUNE.goblin, J = x.J, ten = (J && J.tension) || 0;
    st.hit *= Math.exp(-x.dt*T.snapDecay);
    const want = -T.glower + (P.mid*x.react*T.mids + st.hit*ten*T.snarl)*(.5 + ten);
    st.sn += (Math.max(-1, Math.min(1, want)) - st.sn)*Math.min(1, x.dt*10);
    U.morph = st.sn;
    U.pitch = T.pitch;
  },
});
