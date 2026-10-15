// Ferrofluid: black glossy liquid, a body and three drops orbiting it in a smooth union, spikes rising out of it at its 32
// symmetric points (an icosahedron's corners and its faces' middles). The bass raises the spikes, a kick jolts them, a
// drop's run-up grows them sharp, a breakdown melts it smooth; a drop flings its drops and a spray out, and they fall back.
import { TUNE } from '../../tuning.js';
import { sdfObject, setBead, beads, smin } from './sdf-object.js';
import { lit2d, fres2d } from '../../render/sdf.js';

const t = (1 + Math.sqrt(5))/2, nz = v => { const l = Math.hypot(...v); return v.map(x => x/l); };
const ICO = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nz);
const DOD = []; for (const a of [-1, 1]) for (const b of [-1, 1]) { for (const c of [-1, 1]) DOD.push(nz([a, b, c])); DOD.push(nz([0, a/t, b*t]), nz([a/t, b*t, 0]), nz([a*t, 0, b/t])); }
const DIRS = [...ICO.map(d => [...d, 1]), ...DOD.map(d => [...d, .62])];

const glsl = `
float map(vec3 p){
  float r = length(p); vec3 n = p/max(r, 1e-4); float s = 0.0;
  for (int i = 0; i < 32; i++) s += uD[i].w*pow(max(dot(n, uD[i].xyz), 0.0), uK.y);
  float body = (r - uK.z - uK.x*s)*0.45 + 0.012*BASS*sin(p.x*11.0 + TIME*3.0)*sin(p.y*9.0 - TIME*2.0);
  return smin(body, beads(p, 0.1, 0, 12), 0.16);
}
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  vec3 c = lit(n, rd, vec3(0.012, 0.012, 0.016), 1.6, 120.0, 1.0) + uC0*fres(n, rd)*(0.12 + 0.6*KICK);
  return vec4(c, 1.0);
}`;
function map2d(x, y, z, st){
  const r = Math.hypot(x, y, z) || 1e-4, K = st.K; let s = 0;
  for (const d of DIRS) { const c = (x*d[0] + y*d[1] + z*d[2])/r; if (c > 0) s += d[3]*c**K[1]; }
  return smin((r - K[2] - K[0]*s)*.45, beads(st, x, y, z, .1, 0, 12), .16);
}
export default sdfObject({key: 'ferro', label: 'Ferrofluid', words: 'Black liquid rises into spikes with the bass, its drops orbiting and splashing on the drop',
  stats: 'a ray-marched liquid: 32 spikes, three orbiting drops', glsl, steps: 90, stepK: .8,
  dance: {moves: {still: 1, pulse: 1.4, float: 1, spin: .8, rise: .8, approach: .8, groove: .6}, sym: 5},
  step(st, M, dt){
    const T = TUNE.ferro, D = st.D;
    if (!st.init) { st.init = 1; DIRS.forEach((d, i) => D.set(d, i*4)); st.sp = .1; }
    const want = M.brk ? .015 : T.spike*(.25 + 1.1*M.bass + .5*M.ten + .9*M.anticip);
    st.sp += (want - st.sp)*Math.min(1, dt*(want > st.sp ? 6 : 2));
    st.K[0] = st.sp + T.jolt*M.kick; st.K[1] = 14 + 26*M.ten + 20*M.anticip; st.K[2] = .47 - .05*M.ex; st.K[3] = 0;
    for (let i = 0; i < 3; i++) { const a = M.t*.7 + i*2.094, r = .74 + T.fling*M.ex*(1 + .3*i);
      setBead(st, i, Math.cos(a)*r, Math.sin(a*1.3 + i)*.25, Math.sin(a)*r, .12); }
    for (let i = 3; i < 9; i++) { const d = ICO[(i*5) % 12], r = .5 + 1.2*M.ex*(1 + .15*i) - .5*Math.max(0, .25 - M.ex);
      setBead(st, i, d[0]*r, d[1]*r - .4*M.ex*M.ex, d[2]*r, M.ex > .03 ? .085*Math.sqrt(M.ex) : 0); }
    st.br = Math.max(.6 + st.K[0]*1.1, .9 + 2.9*M.ex);
  },
  map2d, rad: st => .6 + st.K[0]*.5,
  tint2d(p, n, rd, t, st, U){ const c = lit2d(n, rd, [.012, .012, .016], 1.6, 120, 1, U), f = fres2d(n, rd)*(.12 + .6*U.M1[1]); return [c[0] + U.C0[0]*f, c[1] + U.C0[1]*f, c[2] + U.C0[2]*f, 1]; },
});
