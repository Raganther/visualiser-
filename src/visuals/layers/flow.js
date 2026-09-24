// Flow field: particles drifting through a slowly turning field, streaking the trails.
// Its WebGL drawing is a separate points pass in render/gl.js (it needs its own program and buffer).
import { hsv2rgb } from '../../util.js';

export default {
  key: 'flow', kind: 'layer', label: 'Flow field',
  suits: {perc:-.5, T:-.4, mid:.3},   // what music it suits (features centred on 0)
  overWorld: .3,   // how well it sits over a world
  paint: 5,   // paint order in the trails: ribbons, horizon, comets, shockwaves, flow
  accent: 'peak',   // how it fires when it's the accent
  params(P, x){ P.flowCol = hsv2rgb(P.hue + .55, .6, 1).map(v => v*x.eff.flow*(.4 + x.sTreb*x.react*1.5 + P.beat*.5)); P.parts = x.parts; P.NP = x.NP; },
  trails2d(c, P, x){
    const {u, sx, sy} = x, NP = P.NP, parts = P.parts;
    if (P.l.flow > .01) {
      const [r, g, b] = P.flowCol.map(v => Math.round(Math.min(1, v)*255));
      c.fillStyle = `rgb(${r},${g},${b})`; const s2 = Math.max(1.5, u/300);
      for (let i = 0; i < NP; i++) c.fillRect(sx(parts[i*3]) - s2/2, sy(parts[i*3+1]) - s2/2, s2, s2);
    }
  },
};
