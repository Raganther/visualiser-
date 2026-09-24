// Scope line: the waveform drawn across the middle, kicked by stabs.
import { dataArr } from '../../state.js';

export default {
  key: 'scope', kind: 'layer', label: 'Scope line',
  suits: {mid:.7, busy:.3},   // what music it suits (features centred on 0)
  overWorld: -.1,   // how well it sits over a world
  accent: 'hit',   // how it fires when it's the accent
  feedback: {
    glow: `
  {
    float wy=wave(clamp(d.x/ASP+0.5,0.0,1.0))*0.3*(0.6+uReact*0.5);
    float ds=abs(d.y-wy);
    g+=uL_scope*(0.6+uHit*1.6)*(smoothstep(0.01,0.0,ds)+0.3*smoothstep(0.04,0.0,ds))*smoothstep(0.5*ASP,0.38*ASP,abs(d.x));
  }`,
  },
  folded2d(c, P, x){                                   // drawn inside the kaleidoscope fold
    const {u, now, bw, col, glowStroke} = x;
    if (P.l.scope > .01) {
      c.beginPath();
      for (let j = 0; j <= 128; j++) {
        const x = (j/128 - .5)*bw*.9, y = -(dataArr[j*2 > 255 ? 255 : j*2]/128 - 1)*.3*u*(.6 + P.react*.5);
        j ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      glowStroke(c, col(.2), P.l.scope*(.6 + P.hit*1.6), u);
    }
  },
};
