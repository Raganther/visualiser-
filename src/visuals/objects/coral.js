// Brain coral: a sphere carved by a gyroid into a breathing maze of ridges. The maze breathes with the bass, rings of colour
// run over it from a new point on each kick, a drop's run-up tightens it, and a drop heaves it open, shifting the pattern.
import { TUNE } from '../../tuning.js';
import { sdfObject, fib } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const glsl = `
float gy(vec3 p){ vec3 q = p*uK.x + uK.yzw; return dot(sin(q), cos(q.yzx)); }
float map(vec3 p){ return (length(p) - uK2.w - uK2.z*clamp(gy(p)*1.2, -1.0, 1.0))*0.42; }
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  float g = gy(p), ridge = smoothstep(-0.2, 0.7, g);
  vec3 base = mix(uC2*0.12, mix(uC0, vec3(0.9, 0.72, 0.58), 0.45)*0.8, ridge);
  float ang = acos(clamp(dot(normalize(p), uD[0].xyz), -1.0, 1.0)), ring = exp(-pow((ang - uK2.x)*7.0, 2.0))*uK2.y;
  vec3 c = lit(n, rd, base, 0.35, 24.0, 0.12) + base*0.4*fres(n, rd) + uC1*ring*(0.4 + ridge)*1.8 + (uC1*0.5 + 0.5)*uM3.x*0.35*ridge;
  return vec4(c, 1.0);
}`;
const gy = (x, y, z, K) => { const a = x*K[0] + K[1], b = y*K[0] + K[2], c = z*K[0] + K[3]; return Math.sin(a)*Math.cos(b) + Math.sin(b)*Math.cos(c) + Math.sin(c)*Math.cos(a); };
const map2d = (x, y, z, st) => (Math.hypot(x, y, z) - st.K2[3] - st.K2[2]*Math.max(-1, Math.min(1, gy(x, y, z, st.K)*1.2)))*.42;
const AX = fib(12);
export default sdfObject({key: 'coral', label: 'Brain coral', words: 'A brain coral breathes its maze with the bass, rings of colour running over it on each kick',
  stats: 'a ray-marched gyroid maze on a sphere', glsl, steps: 100, stepK: .9,
  dance: {moves: {still: 1, spin: 1.2, rise: 1, float: .8, look: .8, pulse: .7}, sym: 4},
  step(st, M, dt){
    const T = TUNE.coral, K = st.K, K2 = st.K2;
    if (!st.off3) { st.off3 = [0, 0, 0]; st.offT = [0, 0, 0]; st.front = 9; st.ax = AX[0]; K[0] = T.freq; }
    if (M.newKick && M.steady) { st.front = 0; st.ax = AX[Math.floor(st.rand()*12)]; }
    st.front += dt*Math.PI/(M.bp*2);
    for (let i = 0; i < 3; i++) { st.offT[i] += dt*.04*(i + 1); st.off3[i] += (st.offT[i] - st.off3[i])*Math.min(1, dt*1.5); }
    K[0] += (T.freq*(1 + .45*M.anticip + .15*M.ten) - K[0])*Math.min(1, dt*.8); K[1] = st.off3[0]; K[2] = st.off3[1]; K[3] = st.off3[2];
    K2[0] = st.front; K2[1] = Math.max(0, 1 - st.front/Math.PI); K2[2] = T.ridge*(1 + .9*M.bass - .5*M.brk) + .12*M.ex; K2[3] = .6 + .1*M.ex;
    st.D[0] = st.ax[0]; st.D[1] = st.ax[1]; st.D[2] = st.ax[2];
    st.br = K2[3] + K2[2] + .03;
  },
  burst(st){ if (st.offT) for (let i = 0; i < 3; i++) st.offT[i] += 2 + st.rand()*2; },
  map2d, rad: st => .65 + .1*st.ex,
  tint2d(p, n, rd, t, st, U){
    const g = gy(p[0], p[1], p[2], st.K), r = Math.max(0, Math.min(1, (g + .2)/.9)), ridge = r*r*(3 - 2*r);
    const base = [0, 1, 2].map(i => U.C2[i]*.12*(1 - ridge) + (U.C0[i]*.55 + [.9, .72, .58][i]*.45)*.8*ridge), c = lit2d(n, rd, base, .35, 24, .12, U);
    const l = Math.hypot(...p), ang = Math.acos(Math.max(-1, Math.min(1, (p[0]*st.ax[0] + p[1]*st.ax[1] + p[2]*st.ax[2])/l))), ring = Math.exp(-(((ang - st.K2[0])*7)**2))*st.K2[1];
    return [0, 1, 2].map(i => c[i] + U.C1[i]*ring*(.4 + ridge)*1.8 + (U.C1[i]*.5 + .5)*st.ex*.35*ridge).concat(1);
  },
});
