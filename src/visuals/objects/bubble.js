// A soap bubble: a thin film wobbling with the bass, rainbow interference flowing over it (its thickness from noise,
// draining thinner at the top), clear through the middle, its far wall seen through it, small bubbles clinging to it as
// foam. The hats speed the swirl; a drop splits it in two and they merge again.
import { TUNE } from '../../tuning.js';
import { sdfObject, setBead, beads, vnoise, smin } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const glsl = `
float map(vec3 p){ return smin(beads(p, uK.z, 0, 2), beads(p, 0.02, 2, 6), 0.06) + uK.y*sin(p.x*3.0 + TIME*2.0)*sin(p.y*2.5 - TIME*1.7)*sin(p.z*2.0 + TIME*1.1); }
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){ return vec4(0.0); }
vec4 film(vec3 p, vec3 n, vec3 rd, float k){
  float th = vnoise(p*2.4 + vec3(0.0, uK.x, uK.x*0.5))*0.7 + vnoise(p*5.0 - uK.x)*0.3 - 0.35*p.y;
  vec3 ir = 0.5 + 0.5*cos(6.2831*(th*uK.w + vec3(0.0, 0.33, 0.67)));
  float f = fres(n, rd); vec3 N = normalize(uR*n), V = -normalize(uR*rd);
  vec3 c = ir*(0.08 + 1.1*f) + env(reflect(-V, N))*(0.08 + 0.6*f)*mix(vec3(1.0), ir, 0.5);
  c += vec3(1.4, 1.3, 1.15)*pow(max(dot(reflect(-uLd, N), V), 0.0), 120.0)*2.0*k;
  return vec4(c*k, (uK2.x + 0.7*f)*k);
}
vec4 obj(vec3 ro, vec3 rd, float t0, float t1){
  float t = march(ro, rd, t0, t1); if (t < 0.0) return vec4(0.0);
  vec3 p = ro + rd*t; vec4 a = film(p, nrm(p), rd, 1.0);
  float s = t + 0.03;   // (the far wall, from inside)
  for (int i = 0; i < 40; i++) { float d = -map(ro + rd*s); if (d < 0.002 || s > t1) break; s += max(d*0.9, 0.004); }
  if (s > t1) return a;
  vec3 q = ro + rd*s; vec4 b = film(q, -nrm(q), rd, 0.6);
  return a + b*(1.0 - a.a);
}`;
const map2d = (x, y, z, st) => smin(beads(st, x, y, z, st.K[2], 0, 2), beads(st, x, y, z, .02, 2, 6), .06) + st.K[1]*Math.sin(x*3 + st.t*2)*Math.sin(y*2.5 - st.t*1.7)*Math.sin(z*2 + st.t*1.1);
export default sdfObject({key: 'bubble', label: 'Soap bubble', words: 'A soap bubble wobbles with the bass, its rainbow film swirling with the hats; the drop splits it in two',
  stats: 'a ray-marched film: interference colours, the far wall seen through, foam', glsl, custom: true, steps: 70,
  dance: {moves: {still: 1.4, float: 1.6, groove: .6, approach: .8, rise: .5}, sym: 1},
  step(st, M, dt){
    const T = TUNE.bubble, s = Math.min(1, M.ex*1.6), sm = s*s*(3 - 2*s), k = .32*(1 - sm) + .03, r = .62*(1 - .21*sm) - k*.25;
    setBead(st, 0, -.44*sm, 0, 0, r); setBead(st, 1, .44*sm, 0, 0, r);
    for (let i = 0; i < 4; i++) { const a = i*1.9 + M.t*.08, e = .5*Math.sin(i*2.3), rr = .6 + .1*Math.sin(M.t*.5 + i), fr = .14 + .05*((i*.618) % 1);   // the foam, clinging to its side
      setBead(st, 2 + i, Math.cos(a)*Math.cos(e)*rr, Math.sin(e)*rr, Math.sin(a)*Math.cos(e)*rr, i < T.foam ? fr*(1 - .5*sm) : 0); }
    st.K[0] += dt*(.12 + T.swirl*(M.hat + .25*M.kick)); st.K[1] = .012 + T.wobble*M.bass + .025*M.kick; st.K[2] = k; st.K[3] = T.film; st.K2[0] = T.clear;
    st.br = .72 + .44*sm + st.K[1] + (T.foam > 0 ? .12 : 0);
  },
  map2d, rad: st => .65 + .3*st.ex,
  tint2d(p, n, rd, t, st, U){
    const th = vnoise(p[0]*2.4, p[1]*2.4 + st.K[0], p[2]*2.4 + st.K[0]*.5)*.7 - .35*p[1], f = (1 - Math.abs(n[0]*rd[0] + n[1]*rd[1] + n[2]*rd[2]))**3;
    const ir = [0, .33, .67].map(o => .5 + .5*Math.cos(6.2831*(th*st.K[3] + o))), sp = lit2d(n, rd, [0, 0, 0], 2, 120, .4, U);
    return [ir[0]*(.08 + 1.1*f) + sp[0], ir[1]*(.08 + 1.1*f) + sp[1], ir[2]*(.08 + 1.1*f) + sp[2], st.K2[0] + .05 + .7*f];
  },
});
