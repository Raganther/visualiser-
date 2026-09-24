// Wave ring: the waveform wrapped into a ring that swells on the beat.
import { dataArr } from '../../state.js';

export default {
  key: 'ring', kind: 'layer', label: 'Wave ring',
  suits: {perc:.8, low:.4},   // what music it suits (features centred on 0)
  overWorld: -.5,   // how well it sits over a world
  accent: 'bar',   // how it fires when it's the accent
  params(P, x){ P.ringR = x.J.on ? x.J.ringR : .2; P.ringSq = x.J.on ? x.J.ringSq : 0; },
  feedback: {
    uniforms: 'uniform vec2 uRingShape; // ring: radius, squash',
    glow: `
  {
    vec2 dq=d*vec2(1.0+uRingShape.y,1.0-uRingShape.y);
    float rq=length(dq), aq=abs(atan(dq.y,dq.x))/3.14159265;
    float rr=uRingShape.x+uBeat*uReact*0.07+wave(aq)*0.12*(0.6+uReact*0.6);
    float dr=abs(rq-rr);
    g+=uL_ring*(smoothstep(0.012,0.0,dr)+0.35*smoothstep(0.05,0.0,dr));
  }`,
  },
  fbUniforms(gl, u, P){ gl.uniform2f(u.uRingShape, P.ringR, P.ringSq); },
  folded2d(c, P, x){                                   // drawn inside the kaleidoscope fold
    const {u, now, bw, col, glowStroke} = x;
    if (P.l.ring > .01) {
      const R = u*(P.ringR + P.beat*P.react*.07), amp = u*.12*(.6 + P.react*.6);
      c.save(); c.scale(1/(1 + P.ringSq), 1/(1 - P.ringSq));
      c.beginPath();
      for (let j = 0; j <= 128; j++) {
        const a = j/128*Math.PI*2, t = a <= Math.PI ? a/Math.PI : 2 - a/Math.PI;
        const r = R + (dataArr[Math.min(255, Math.floor(t*255))]/128 - 1)*amp;
        j ? c.lineTo(Math.cos(a)*r, Math.sin(a)*r) : c.moveTo(Math.cos(a)*r, Math.sin(a)*r);
      }
      c.closePath(); c.restore(); glowStroke(c, col(.1), P.l.ring, u);
    }
  },
};
