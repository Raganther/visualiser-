// The cosmos's places: a galaxy of star systems grown from seeds. A system's index says where it sits: which galaxy (the
// track's), which arm (its mood: cold, warm or hot) and how far along it, so the same index always gives the same system,
// a track always takes the same journey, and sections that sound alike end up as neighbours.
import { V, around } from '../../../scene/camera.js';

const {add, mul, norm} = V;
// seeded numbers (mulberry32), so a system is the same every visit and the page's own random draws are untouched
export const rng = seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0)/4294967296; };
export const hashStr = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 100000; };
export const ARM_WORDS = ['cold', 'warm', 'hot'];
export const sysIndex = (galaxy, arm, k) => galaxy*1000 + arm*300 + k;
export const armOf = idx => Math.floor((((idx % 1000) + 1000) % 1000)/300) % 3;
// the arm a section belongs on, from how intense it is and its pace
export const armFor = (T, pace) => { const h = T*.7 + pace*.3; return h < .38 ? 0 : h < .66 ? 1 : 2; };
export const KIND = {rock: 0, gas: 1, ice: 2, lava: 3};

// planets' kinds by heat: a cold system is ice and pale giants, a hot one lava and rock; inside hotter than outside
const COLD = {ice: 3, gas: 1.3, rock: 1, lava: 0}, HOT = {lava: 3, rock: 2, gas: 1, ice: .15};
const INNER = {lava: 2, rock: 1.6, gas: .3, ice: .4}, OUTER = {lava: .1, rock: .6, gas: 2.2, ice: 1.8};
function kindAt(r, heat, out){
  const w = Object.keys(COLD).map(k => [k, (COLD[k]*(1 - heat) + HOT[k]*heat)*(INNER[k]*(1 - out) + OUTER[k]*out)]);
  let x = r()*w.reduce((s, [, v]) => s + v, 0); for (const [k, v] of w) if ((x -= v) <= 0) return k;
  return 'rock';
}
// a star system: a star (bigger and deeper-coloured when hot), three to six planets, their rings and moons
export function makeSystem(idx){
  const r = rng(idx*7919 + 104729), arm = armOf(idx), heat = Math.min(1, Math.max(0, arm/2 + (r() - .5)*.3)), bodies = [];
  const sun = {kind: 'sun', r: 2.5 + heat*3 + r()*1.5, p: [0, 0, 0], slot: Math.floor(r()*3), off: (r() - .5)*.1, sat: .08 + heat*.45 + r()*.1};
  const n = 3 + Math.floor(r()*4); let orbit = 18 + r()*8 + sun.r*2;
  for (let i = 0; i < n; i++) {
    const kind = kindAt(r, heat, i/(n - 1));
    const rad = kind === 'gas' ? 1.6 + r()*1.6 : kind === 'ice' ? .7 + r()*.7 : .45 + r()*.6, tilt = (r() - .5)*.8, ta = r()*6.28;
    const ring = kind === 'gas' ? (r() < .6 ? 2.1 + r()*.5 : 0) : kind === 'ice' && r() < .25 ? 1.9 + r()*.4 : 0;
    const pl = {kind, r: rad, orbit, ph: r()*6.28, w: .6/Math.pow(orbit, 1.5)*(.7 + r()*.6), inc: (r() - .5)*.08, p: [0, 0, 0],
      axis: norm([Math.sin(ta)*tilt, 1, Math.cos(ta)*tilt]), ring, slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: (.03 + r()*.08)*(r() < .5 ? -1 : 1)};
    bodies.push(pl);
    const moons = kind === 'gas' ? Math.floor(r()*3) : r() < .35 ? 1 : 0;
    for (let m = 0; m < moons; m++) bodies.push({kind: r() < .5 ? 'rock' : 'ice', moon: true, parent: pl, r: rad*(.16 + r()*.14),
      dist: rad*((ring || 1.6) + 1.2 + m*1.3 + r()*.6), ph: r()*6.28, w: .12 + r()*.12, p: [0, 0, 0], axis: pl.axis, ring: 0,
      slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: .05});
    orbit += 16 + r()*16 + rad*3;
  }
  return {idx, arm, heat, sun, bodies, R: orbit};
}
// where everything is at motion time T: planets round the star, moons round their planets
export function place(sys, T){
  for (const b of sys.bodies) {
    if (b.moon) continue;
    const a = b.ph + T*b.w; b.p = [Math.cos(a)*b.orbit, Math.sin(a)*b.orbit*b.inc, Math.sin(a)*b.orbit];
  }
  for (const b of sys.bodies) if (b.moon) {
    const [u, v] = around(b.axis), a = b.ph + T*b.w;
    b.p = add(b.parent.p, add(mul(u, Math.cos(a)*b.dist), mul(v, Math.sin(a)*b.dist)));
  }
}
export const nameOf = b => !b ? 'the star' : b.moon ? (b.kind === 'ice' ? 'an icy moon' : 'a small moon')
  : {rock: 'a rocky world', gas: b.ring ? 'a ringed gas giant' : 'a gas giant', ice: b.ring ? 'a ringed ice world' : 'an ice world', lava: 'a lava world'}[b.kind];
