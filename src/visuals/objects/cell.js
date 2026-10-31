// A living cell: a translucent membrane round a glowing nucleus, small organelles drifting inside it through a faintly lit
// cytoplasm. It breathes with the bass, the kick flashes the nucleus, the organelles stir with the hats, and a drop divides
// it (or every few bars, when asked: TUNE.cell.divideBars): the membrane pinches into two, the nucleus splits, and they
// slowly rejoin.
import { TUNE } from '../../tuning.js';
import { sdfObject, setBead, beads, vnoise } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const glsl = `
float map(vec3 p){ return beads(p, uK.w, 0, 2) + uK.z*(vnoise(p*3.0 + TIME*0.25) - 0.5); }
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){ return vec4(0.0); }
float inner(vec3 q){ return min(beads(q, 0.08, 2, 4), beads(q, 0.02, 4, 12)); }
vec4 obj(vec3 ro, vec3 rd, float t0, float t1){
  float t = march(ro, rd, t0, t1); if (t < 0.0) return vec4(0.0);
  vec3 p = ro + rd*t, n = nrm(p); float f = fres(n, rd); vec3 N = normalize(uR*n), V = -normalize(uR*rd);
  vec3 mc = uC0*(0.06 + 0.9*f) + env(reflect(-V, N))*0.25*f + vec3(1.3, 1.2, 1.1)*pow(max(dot(reflect(-uLd, N), V), 0.0), 60.0);
  float ma = 0.16 + 0.6*f;
  // inside: the nucleus and the organelles, through a glowing cytoplasm
  float s = t + 0.01, glow = 0.0; vec4 ic = vec4(0.0);
  for (int i = 0; i < 56; i++) {
    vec3 q = ro + rd*s; float dn = beads(q, 0.08, 2, 4), dO = beads(q, 0.02, 4, 12), d = min(dn, dO);
    glow += exp(-max(dn, 0.0)*9.0)*0.025;
    if (d < 0.002) {
      vec2 e = vec2(0.003, 0.0); vec3 nn = normalize(vec3(inner(q + e.xyy) - inner(q - e.xyy), inner(q + e.yxy) - inner(q - e.yxy), inner(q + e.yyx) - inner(q - e.yyx)));
      vec3 base = dn < dO ? uC1*(0.5 + 1.8*uK.y)*uK2.y : uC2*0.8;
      ic = vec4(lit(nn, rd, base, 0.6, 30.0, 0.15) + (dn < dO ? uC1*uK.y*0.9*uK2.y : vec3(0.0)), 1.0); break; }
    s += max(d*0.9, 0.008); if (s > t1 || map(q) > 0.02) break;
  }
  vec3 inside = ic.rgb + glow*uC1*(0.6 + uK.y)*uK2.y; float ia = max(ic.a, min(1.0, glow*0.6));
  return vec4(mc + inside*(1.0 - ma), ma + ia*(1.0 - ma));
}`;
const map2d = (x, y, z, st) => beads(st, x, y, z, st.K[3], 0, 2) + st.K[2]*(vnoise(x*3 + st.t*.25, y*3 + st.t*.25, z*3 + st.t*.25) - .5);
const ORG = Array.from({length: 8}, (_, i) => ({a: i*2.4, b: i*1.3, r: .2 + .17*((i*.618) % 1), s: .25 + .3*((i*.37) % 1), z: .045 + .03*((i*.29) % 1)}));
export default sdfObject({key: 'cell', label: 'Living cell', words: 'A living cell breathes with the bass, its nucleus flashing on the kick; the drop divides it',
  stats: 'a ray-marched membrane, nucleus and eight organelles', glsl, custom: true, steps: 64,
  dance: {moves: {still: 1.2, float: 1.4, pulse: 1, groove: .6, approach: .7, rise: .5}, sym: 1},
  onBeat(st, pos){ const n = TUNE.cell.divideBars; if (pos === 0 && n > 0 && st.bars % n === 0 && st.ex < .2) { st.ex = 1; st.exHold = .2; } },   // (dividing on its own, every few bars)
  step(st, M, dt){
    const T = TUNE.cell; st.drift = (st.drift || 0) + dt*T.drift*(.6 + 1.6*M.hat);
    const s = Math.min(1, M.ex*1.4), sm = s*s*(3 - 2*s), br = 1 + .06*M.bass + .03*M.kick, k = .3*(1 - sm) + .03, r = (.6*(1 - .2*sm) - k*.25)*br;
    setBead(st, 0, -.42*sm, 0, 0, r); setBead(st, 1, .42*sm, 0, 0, r);
    setBead(st, 2, -.42*sm, .02, 0, .19*(1 - .15*sm)*br); setBead(st, 3, .42*sm, .02, 0, sm > .05 ? .19*(1 - .15*sm)*br : 0);
    ORG.forEach((o, i) => { const a = o.a + st.drift*o.s, b = o.b + st.drift*o.s*.7, side = sm > .05 ? (i % 2 ? .42 : -.42)*sm : 0;
      setBead(st, 4 + i, side + Math.cos(a)*Math.cos(b)*o.r*1.1, Math.sin(b)*o.r, Math.sin(a)*Math.cos(b)*o.r*1.1, i < T.organelles ? o.z*br : 0); });
    st.K[0] = 0; st.K[1] = M.kick; st.K[2] = T.wobble*(1 + .8*M.bass); st.K[3] = k; st.K2[1] = T.glow;
    st.br = (.7 + .42*sm)*br + .04;
  },
  map2d, rad: st => .65 + .35*st.ex,
  tint2d(p, n, rd, t, st, U){
    const f = (1 - Math.abs(n[0]*rd[0] + n[1]*rd[1] + n[2]*rd[2]))**3, sp = lit2d(n, rd, [0, 0, 0], 1.3, 60, .25, U), B = st.Bd;
    let g = 0; for (const i of [2, 3]) { if (B[i*4 + 3] <= 0) continue; const v = [B[i*4] - p[0], B[i*4 + 1] - p[1], B[i*4 + 2] - p[2]], d = v[0]*rd[0] + v[1]*rd[1] + v[2]*rd[2];
      const c = Math.hypot(v[0] - rd[0]*d, v[1] - rd[1]*d, v[2] - rd[2]*d); g = Math.max(g, Math.max(0, 1 - c/B[i*4 + 3])); }
    const nuc = g*(.6 + 1.6*st.K[1])*st.K2[1], a = .16 + .6*f;
    return [U.C0[0]*(.06 + .9*f) + sp[0] + U.C1[0]*nuc, U.C0[1]*(.06 + .9*f) + sp[1] + U.C1[1]*nuc, U.C0[2]*(.06 + .9*f) + sp[2] + U.C1[2]*nuc, Math.min(1, a + g*.8)];
  },
});
