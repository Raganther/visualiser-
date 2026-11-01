// Brain coral: a sphere carved into ridges by a triply periodic surface: a maze (the gyroid), holes (Schwarz's P), a
// diamond lattice (Schwarz's D) or flowing bands (TUNE.coral.pattern). The ridges breathe with the bass, rings of colour run
// over it from a new point on each kick, a drop's run-up tightens it, and a drop heaves it open, shifting the pattern.
import { TUNE } from '../../tuning.js';
import { sdfObject, fib } from './sdf-object.js';
import { lit2d } from '../../render/sdf.js';

const glsl = `
float gy(vec3 p){ vec3 q = p*uK.x + uK.yzw; int k = int(uD[1].x + 0.5);
  if (k == 1) return (cos(q.x) + cos(q.y) + cos(q.z))*0.9;
  if (k == 2) return (sin(q.x)*sin(q.y)*sin(q.z) + sin(q.x)*cos(q.y)*cos(q.z) + cos(q.x)*sin(q.y)*cos(q.z) + cos(q.x)*cos(q.y)*sin(q.z))*1.4;
  if (k == 3) return sin(q.y + sin(q.x*0.7)*2.0 + cos(q.z*0.6)*1.5)*1.2;
  return dot(sin(q), cos(q.yzx)); }
float map(vec3 p){
  float r = length(p), ob = r - uK2.w - uK2.z;
  if (ob > 0.05) return ob;   // (outside the ridges' reach: the sphere they lie in)
  return (r - uK2.w - uK2.z*clamp(gy(p)*1.2, -1.0, 1.0))*0.42; }
vec4 shade(vec3 p, vec3 n, vec3 rd, float t){
  float g = gy(p), ridge = smoothstep(-0.2, 0.7, g);
  vec3 base = mix(uC2*0.12, mix(uC0, vec3(0.9, 0.72, 0.58), 0.45)*0.8, ridge);
  float ang = acos(clamp(dot(normalize(p), uD[0].xyz), -1.0, 1.0)), ring = exp(-pow((ang - uK2.x)*7.0, 2.0))*uK2.y;
  vec3 c = lit(n, rd, base, 0.35, 24.0, 0.12) + base*0.4*fres(n, rd) + uC1*ring*(0.4 + ridge)*1.8 + (uC1*0.5 + 0.5)*uM3.x*0.35*ridge;
  return vec4(c, 1.0);
}`;
function gy(x, y, z, K, k){ const a = x*K[0] + K[1], b = y*K[0] + K[2], c = z*K[0] + K[3], S = Math.sin, C = Math.cos;
  if (k === 1) return (C(a) + C(b) + C(c))*.9;
  if (k === 2) return (S(a)*S(b)*S(c) + S(a)*C(b)*C(c) + C(a)*S(b)*C(c) + C(a)*C(b)*S(c))*1.4;
  if (k === 3) return S(b + S(a*.7)*2 + C(c*.6)*1.5)*1.2;
  return S(a)*C(b) + S(b)*C(c) + S(c)*C(a); }
function map2d(x, y, z, st){ const r = Math.hypot(x, y, z), out = r - st.K2[3] - st.K2[2]; if (out > .05) return out;
  return (r - st.K2[3] - st.K2[2]*Math.max(-1, Math.min(1, gy(x, y, z, st.K, st.pat)*1.2)))*.42; }
const AX = fib(12);
export default sdfObject({key: 'coral', label: 'Brain coral', words: 'A brain coral breathes its maze with the bass, rings of colour running over it on each kick',
  stats: 'a ray-marched maze on a sphere: gyroid, holes, diamond or bands', glsl, steps: 100, stepK: .9,
  dance: {moves: {still: 1, spin: 1.2, rise: 1, float: .8, look: .8, pulse: .7}, sym: 4},
  step(st, M, dt){
    const T = TUNE.coral, K = st.K, K2 = st.K2;
    if (!st.off3) { st.off3 = [0, 0, 0]; st.offT = [0, 0, 0]; st.front = 9; st.ax = AX[0]; K[0] = T.freq; }
    if (M.newKick && M.steady) { st.front = 0; st.ax = AX[Math.floor(st.rand()*12)]; }
    st.front += dt*Math.PI/(M.bp*2)*T.ring;
    for (let i = 0; i < 3; i++) { st.offT[i] += dt*.04*(i + 1)*T.drift; st.off3[i] += (st.offT[i] - st.off3[i])*Math.min(1, dt*1.5); }
    K[0] += (T.freq*(1 + .45*M.anticip + .15*M.ten) - K[0])*Math.min(1, dt*.8); K[1] = st.off3[0]; K[2] = st.off3[1]; K[3] = st.off3[2];
    K2[0] = st.front; K2[1] = Math.max(0, 1 - st.front/Math.PI); K2[2] = T.ridge*(1 + .9*M.bass - .5*M.brk) + T.heave*M.ex; K2[3] = .6 + .1*M.ex;
    st.pat = Math.round(T.pattern); st.D[0] = st.ax[0]; st.D[1] = st.ax[1]; st.D[2] = st.ax[2]; st.D[4] = st.pat;
    st.br = K2[3] + K2[2] + .03;
  },
  burst(st){ if (st.offT) for (let i = 0; i < 3; i++) st.offT[i] += 2 + st.rand()*2; },
  map2d, rad: st => .65 + .1*st.ex,
  tint2d(p, n, rd, t, st, U){
    const g = gy(p[0], p[1], p[2], st.K, st.pat), r = Math.max(0, Math.min(1, (g + .2)/.9)), ridge = r*r*(3 - 2*r);
    const base = [0, 1, 2].map(i => U.C2[i]*.12*(1 - ridge) + (U.C0[i]*.55 + [.9, .72, .58][i]*.45)*.8*ridge), c = lit2d(n, rd, base, .35, 24, .12, U);
    const l = Math.hypot(...p), ang = Math.acos(Math.max(-1, Math.min(1, (p[0]*st.ax[0] + p[1]*st.ax[1] + p[2]*st.ax[2])/l))), ring = Math.exp(-(((ang - st.K2[0])*7)**2))*st.K2[1];
    return [0, 1, 2].map(i => c[i] + U.C1[i]*ring*(.4 + ridge)*1.8 + (U.C1[i]*.5 + .5)*st.ex*.35*ridge).concat(1);
  },
});
