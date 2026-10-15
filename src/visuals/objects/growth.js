// Growing crystals: a cluster of hexagonal crystals pointing out from a heart, each milky at its base and glowing at its
// point. They grow longer through a build, light runs up them on each kick, the hats glint on their faces, and a drop
// flings them out from the heart before they settle back.
import { TUNE } from '../../tuning.js';
import { sdfObject, fib, smin } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const N = 12, AX = fib(N).map((d, i) => { const j = [d[0] + Math.sin(i*7.1)*.18, d[1] + Math.sin(i*3.7)*.18, d[2] + Math.sin(i*5.3)*.18], l = Math.hypot(...j); return j.map(v => v/l); });
const LEN = AX.map((_, i) => .55 + .45*((i*.618 + .2) % 1)), RAD = AX.map((_, i) => .09 + .05*((i*.37) % 1));
const glsl = `
float gZ;
float cry(vec3 p, vec3 a, float L, float r, out float hz){
  float z = dot(p, a) - uK.w; vec3 q = p - a*dot(p, a);
  vec3 u = normalize(cross(a, abs(a.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), v = cross(a, u);
  vec2 xy = abs(vec2(dot(q, u), dot(q, v)));
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  xy -= 2.0*min(dot(k.xy, xy), 0.0)*k.xy;
  float dh = length(xy - vec2(clamp(xy.x, -k.z*r, k.z*r), r))*sign(xy.y - r);
  hz = z/max(L, 1e-3);
  return max(max(dh, (z + 1.8*length(xy) - L)/2.06), -z);
}
float map(vec3 p){
  float d = 1e3, hz;
  for (int i = 0; i < 12; i++) { if (uD[i].w < 0.01) continue; float c = cry(p, uD[i].xyz, uD[i].w*uK.z, 0.09 + 0.05*fract(float(i)*0.37), hz); if (c < d) { d = c; gZ = hz; } }
  return smin(length(p) - 0.24, d, 0.06);
}
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  map(p); float hz = clamp(gZ, 0.0, 1.0);
  vec3 base = mix(vec3(0.2, 0.2, 0.24) + uC0*0.12, uC1*1.1, hz*hz);
  float band = exp(-pow((hz - uK.x)*7.0, 2.0))*uK.y;
  vec3 c = lit(n, rd, base, 1.4, 90.0, 0.5) + uC1*pow(hz, 4.0)*0.8 + uC2*band*2.2;
  c += vec3(1.0)*step(0.985, h31(floor(p*28.0) + floor(TIME*8.0)))*HAT*0.9;
  return vec4(c, 1.0);
}`;
function cry(x, y, z, a, L, r, off){
  const dp = x*a[0] + y*a[1] + z*a[2], zz = dp - off, qx = x - a[0]*dp, qy = y - a[1]*dp, qz = z - a[2]*dp, rad = Math.hypot(qx, qy, qz);
  return [Math.max(rad - r, (zz + 1.8*rad - L)/2.06, -zz), zz/Math.max(L, 1e-3)];   // (a round prism: plainer)
}
function map2d(x, y, z, st){
  let d = 1e3; st.hz = 0;
  for (let i = 0; i < N; i++) { const c = cry(x, y, z, AX[i], st.D[i*4 + 3]*st.K[2], RAD[i], st.K[3]); if (c[0] < d) { d = c[0]; st.hz = c[1]; } }
  return smin(Math.hypot(x, y, z) - .24, d, .06);
}
export default sdfObject({key: 'growth', label: 'Growing crystals', words: 'A cluster of crystals grows through a build, light running up them on each kick',
  stats: 'twelve ray-marched hexagonal crystals from a heart', glsl, steps: 90,
  dance: {moves: {still: 1, spin: 1.2, face: 1, rise: .8, pulse: .8, approach: .6}, sym: 6},
  step(st, M, dt){
    const T = TUNE.growth, K = st.K;
    if (!st.g) { st.g = .5; st.ph = 9; AX.forEach((a, i) => st.D.set([...a, LEN[i]], i*4)); }
    const want = (T.grow*(.45 + .55*M.ten + .3*M.anticip))*(M.brk ? .8 : 1);
    st.g += (want - st.g)*Math.min(1, dt*.6);
    if (M.newKick) st.ph = 0; st.ph += dt/Math.max(.3, M.bp*1.2);
    K[0] = st.ph*1.3 - .15; K[1] = Math.max(0, 1 - st.ph); K[2] = .45 + .5*st.g; K[3] = T.fling*M.ex;
    st.br = .25 + K[2] + K[3] + .04;
  },
  map2d, rad: st => .3 + st.K[2]*.8 + st.K[3],
  tint2d(p, n, rd, t, st, U){
    map2d(p[0], p[1], p[2], st); const hz = Math.max(0, Math.min(1, st.hz)), band = Math.exp(-(((hz - st.K[0])*7)**2))*st.K[1];
    const base = [0, 1, 2].map(i => (.2 + U.C0[i]*.12)*(1 - hz*hz) + U.C1[i]*1.1*hz*hz), c = lit2d(n, rd, base, 1.4, 90, .5, U);
    return [0, 1, 2].map(i => c[i] + U.C1[i]*hz**4*.8 + U.C2[i]*band*2.2).concat(1);
  },
});
