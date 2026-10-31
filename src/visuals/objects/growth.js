// Growing crystals: a cluster of hexagonal crystals pointing out from a heart, each milky at its base and glowing at its
// point. They grow longer through a build, light runs up them on each kick, the hats glint on their faces, each phrase
// some grow and some shrink back (TUNE.growth.regrow), and a drop flings them out from the heart before they settle back.
import { TUNE } from '../../tuning.js';
import { sdfObject, fib, smin } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const N = 16, AX = fib(N).map((d, i) => { const j = [d[0] + Math.sin(i*7.1)*.18, d[1] + Math.sin(i*3.7)*.18, d[2] + Math.sin(i*5.3)*.18], l = Math.hypot(...j); return j.map(v => v/l); });
const RAD = AX.map((_, i) => .09 + .05*((i*.37) % 1));
// each crystal's own frame round its axis (worked out once here, not per pixel)
const UAX = AX.map(a => { const h = Math.abs(a[1]) < .9 ? [0, 1, 0] : [1, 0, 0], c = [a[1]*h[2] - a[2]*h[1], a[2]*h[0] - a[0]*h[2], a[0]*h[1] - a[1]*h[0]], l = Math.hypot(...c); return c.map(v => v/l); });
const glsl = `
float gZ;
float cry(vec3 p, vec3 a, vec3 u, float L, float r, out float hz){
  float da = dot(p, a), z = da - uK.w; vec3 q = p - a*da, v = cross(a, u);
  vec2 xy = abs(vec2(dot(q, u), dot(q, v)));
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  xy -= 2.0*min(dot(k.xy, xy), 0.0)*k.xy;
  float dh = length(xy - vec2(clamp(xy.x, -k.z*r, k.z*r), r))*sign(xy.y - r);
  hz = z/max(L, 1e-3);
  return max(max(dh, (z + 1.8*length(xy) - L)/2.06), -z);
}
float map(vec3 p){
  float r = length(p); if (r > uK2.x) return r - uK2.x + 0.05;   // (beyond the longest crystal: its sphere)
  float d = 1e3, hz;
  for (int i = 0; i < 16; i++) { vec4 A = uD[i]; if (A.w < 0.01) continue;
    if (dot(p, A.xyz) < -0.2) continue;   // (behind the heart from this one: it can't be the nearest)
    float c = cry(p, A.xyz, uD[16 + i].xyz, A.w*uK.z, uD[16 + i].w, hz); if (c < d) { d = c; gZ = hz; } }
  return smin(r - 0.24, d, 0.06);
}
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  map(p); float hz = clamp(gZ, 0.0, 1.0);
  vec3 base = mix(vec3(0.2, 0.2, 0.24) + uC0*0.12, uC1*1.1, hz*hz);
  float band = exp(-pow((hz - uK.x)*7.0, 2.0))*uK.y;
  vec3 c = lit(n, rd, base, 1.4, 90.0, 0.5) + uC1*pow(hz, 4.0)*uK2.y + uC2*band*2.2;
  c += vec3(1.0)*step(0.985, h31(floor(p*28.0) + floor(TIME*8.0)))*HAT*0.9;
  return vec4(c, 1.0);
}`;
function cry(x, y, z, a, L, r, off){
  const dp = x*a[0] + y*a[1] + z*a[2], zz = dp - off, qx = x - a[0]*dp, qy = y - a[1]*dp, qz = z - a[2]*dp, rad = Math.hypot(qx, qy, qz);
  return [Math.max(rad - r, (zz + 1.8*rad - L)/2.06, -zz), zz/Math.max(L, 1e-3)];   // (a round prism: plainer)
}
function map2d(x, y, z, st){
  const r = Math.hypot(x, y, z); if (r > st.K2[0]) return r - st.K2[0] + .05;
  let d = 1e3; st.hz = 0;
  for (let i = 0; i < N; i++) { const L = st.D[i*4 + 3]; if (L < .01) continue; const c = cry(x, y, z, AX[i], L*st.K[2], RAD[i], st.K[3]); if (c[0] < d) { d = c[0]; st.hz = c[1]; } }
  return smin(r - .24, d, .06);
}
export default sdfObject({key: 'growth', label: 'Growing crystals', words: 'A cluster of crystals grows through a build, light running up them on each kick',
  stats: 'up to sixteen ray-marched hexagonal crystals from a heart', glsl, steps: 90,
  dance: {moves: {still: 1, spin: 1.2, face: 1, rise: .8, pulse: .8, approach: .6}, sym: 6},
  onBeat(st, pos){ if (pos === 0 && st.bars % 4 === 0 && st.len) st.lenT = st.lenT.map((v, i) => .55 + TUNE.growth.spread*(st.rand()*2 - 1)*TUNE.growth.regrow + (1 - TUNE.growth.regrow)*(v - .55)); },   // (each phrase: some grow, some shrink back)
  step(st, M, dt){
    const T = TUNE.growth, K = st.K, n = Math.max(1, Math.min(N, Math.round(T.count)));
    if (!st.len) { st.g = .5; st.ph = 9; st.lenT = AX.map((_, i) => .55 + T.spread*(((i*.618 + .2) % 1)*2 - 1)); st.len = st.lenT.slice(); }
    const want = (T.grow*(.45 + .55*M.ten + .3*M.anticip))*(M.brk ? .8 : 1);
    st.g += (want - st.g)*Math.min(1, dt*.6);
    if (M.newKick) st.ph = 0; st.ph += dt/Math.max(.3, M.bp*1.2);
    let mx = 0;
    for (let i = 0; i < N; i++) { st.len[i] += (st.lenT[i] - st.len[i])*Math.min(1, dt*.5); const L = i < n ? Math.max(.1, st.len[i]) : 0;
      st.D.set([AX[i][0], AX[i][1], AX[i][2], L], i*4); st.D.set([UAX[i][0], UAX[i][1], UAX[i][2], RAD[i]], (16 + i)*4); mx = Math.max(mx, L); }
    K[0] = st.ph*1.3 - .15; K[1] = Math.max(0, 1 - st.ph); K[2] = .45 + .5*st.g; K[3] = T.fling*M.ex;
    st.K2[0] = mx*K[2] + K[3] + .08; st.K2[1] = T.tip;
    st.br = Math.max(.3, st.K2[0]) + .02;
  },
  map2d, rad: st => .3 + st.K[2]*.8 + st.K[3],
  tint2d(p, n, rd, t, st, U){
    map2d(p[0], p[1], p[2], st); const hz = Math.max(0, Math.min(1, st.hz)), band = Math.exp(-(((hz - st.K[0])*7)**2))*st.K[1];
    const base = [0, 1, 2].map(i => (.2 + U.C0[i]*.12)*(1 - hz*hz) + U.C1[i]*1.1*hz*hz), c = lit2d(n, rd, base, 1.4, 90, .5, U);
    return [0, 1, 2].map(i => c[i] + U.C1[i]*hz**4*st.K2[1] + U.C2[i]*band*2.2).concat(1);
  },
});
