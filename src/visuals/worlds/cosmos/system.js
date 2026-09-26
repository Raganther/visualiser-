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
export const KIND = {rock: 0, gas: 1, ice: 2, lava: 3, ocean: 4};
// where a system sits in the galaxy (its own units): on its arm's spiral, further out the further along the arm it is
export const GAL_ARM = k => [k*2.0944, 10, 1.6, .3];   // an arm's start angle, start radius, radius per system, turn per system
export function galPos(idx){
  const a = armOf(idx), k = (((idx % 1000) + 1000) % 1000) - a*300, [a0, r0, dr, turn] = GAL_ARM(a), r = rng(idx*31 + 7);
  const th = a0 + k*turn + (r() - .5)*.1, rho = r0 + k*dr + (r() - .5)*1.2;
  return [Math.cos(th)*rho, (r() - .5)*.8, Math.sin(th)*rho];
}
export const STAR = {star: 0, binary: 1, pulsar: 2, hole: 3};

// planets' kinds by heat: a cold system is ice and pale giants, a hot one lava and rock; inside hotter than outside
const COLD = {ice: 3, gas: 1.3, rock: 1, lava: 0, ocean: .8}, HOT = {lava: 3, rock: 2, gas: 1, ice: .15, ocean: .2};
const INNER = {lava: 2, rock: 1.6, gas: .3, ice: .4, ocean: 1.2}, OUTER = {lava: .1, rock: .6, gas: 2.2, ice: 1.8, ocean: .5};
function kindAt(r, heat, out){
  const w = Object.keys(COLD).map(k => [k, (COLD[k]*(1 - heat) + HOT[k]*heat)*(INNER[k]*(1 - out) + OUTER[k]*out)]);
  let x = r()*w.reduce((s, [, v]) => s + v, 0); for (const [k, v] of w) if ((x -= v) <= 0) return k;
  return 'rock';
}
// the star's kind by heat: hot arms have black holes and twin stars, warm ones twins and pulsars, cold ones mostly lone stars
function starAt(r, heat){
  const x = r();
  if (heat > .75) return x < .2 ? 'hole' : x < .45 ? 'binary' : 'star';
  if (heat > .35) return x < .18 ? 'binary' : x < .33 ? 'pulsar' : 'star';
  return x < .12 ? 'pulsar' : 'star';
}
// a star system: a star (bigger and deeper-coloured when hot; or twin stars, a pulsar, a black hole), three to six planets
// with their rings, moons, storms, cities and auroras, sometimes an asteroid belt, sometimes a vast ring built round the star
export function makeSystem(idx){
  const r = rng(idx*7919 + 104729), arm = armOf(idx), heat = Math.min(1, Math.max(0, arm/2 + (r() - .5)*.3)), bodies = [];
  const type = starAt(r, heat);
  const sun = {kind: 'sun', type, r: type === 'hole' ? 2 + r()*1.2 : type === 'pulsar' ? .8 + r()*.4 : 2.5 + heat*3 + r()*1.5, p: [0, 0, 0],
    slot: Math.floor(r()*3), off: (r() - .5)*.1, sat: type === 'pulsar' ? .15 : .08 + heat*.45 + r()*.1,
    axis: norm([(r() - .5)*.8, 1, (r() - .5)*.8]), tilt: .5 + r()*.6};   // a pulsar's beams sweep round this axis; a hole's disk lies across it
  if (type === 'binary') sun.twin = {r: sun.r*(.4 + r()*.3), sep: sun.r*(3.5 + r()*2), w: .08 + r()*.08, ph: r()*6.28, slot: (sun.slot + 1 + Math.floor(r()*2)) % 3, p: [0, 0, 0]};
  const n = 3 + Math.floor(r()*4); let orbit = 18 + r()*8 + (sun.twin ? sun.twin.sep : 0) + sun.r*2, orbits = [];
  for (let i = 0; i < n; i++) {
    const kind = kindAt(r, heat, i/(n - 1));
    const rad = kind === 'gas' ? 1.6 + r()*1.6 : kind === 'ice' ? .7 + r()*.7 : .45 + r()*.6, tilt = (r() - .5)*.8, ta = r()*6.28;
    const ring = kind === 'gas' ? (r() < .6 ? 2.1 + r()*.5 : 0) : kind === 'ice' && r() < .25 ? 1.9 + r()*.4 : 0;
    const pl = {kind, r: rad, orbit, ph: r()*6.28, w: .6/Math.pow(orbit, 1.5)*(.7 + r()*.6), inc: (r() - .5)*.08, p: [0, 0, 0],
      axis: norm([Math.sin(ta)*tilt, 1, Math.cos(ta)*tilt]), ring, slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: (.03 + r()*.08)*(r() < .5 ? -1 : 1),
      // what's on it: lights on the night side, auroras at the poles, a great storm, clouds
      city: (kind === 'rock' || kind === 'ocean') && r() < .4 ? 1 : 0, aurora: kind !== 'lava' && r() < .45 ? 1 : 0,
      storm: kind === 'gas' && r() < .65 ? 1 : 0, cloud: kind === 'ocean' ? .5 + r()*.3 : kind === 'rock' && r() < .3 ? .3 : 0};
    orbits.push(orbit);
    bodies.push(pl);
    const moons = kind === 'gas' ? Math.floor(r()*3) : r() < .35 ? 1 : 0;
    for (let m = 0; m < moons; m++) bodies.push({kind: r() < .5 ? 'rock' : 'ice', moon: true, parent: pl, r: rad*(.16 + r()*.14),
      dist: rad*((ring || 1.6) + 1.2 + m*1.3 + r()*.6), ph: r()*6.28, w: .12 + r()*.12, p: [0, 0, 0], axis: pl.axis, ring: 0,
      slot: Math.floor(r()*3), off: (r() - .5)*.12, seed: r(), spin: .05, city: 0, aurora: 0, storm: 0, cloud: 0});
    orbit += 16 + r()*16 + rad*3;
  }
  // an asteroid belt in a gap between two planets; a ring built round the star (rarer where it's hot)
  const g = 1 + Math.floor(r()*Math.max(1, orbits.length - 1)), belt = orbits.length > 2 && r() < .55
    ? {R: (orbits[g - 1] + orbits[g])/2, W: 3 + r()*3, H: 1.2 + r()*.8} : null;
  const halo = r() < .22*(1.2 - heat) ? {R: orbits[Math.min(1, orbits.length - 1)]*(.8 + r()*.15), H: 1.2 + r()*1.6, slot: Math.floor(r()*3)} : null;
  // where a centrepiece stands, as a vast monument: in orbit round the first planet
  const mon = {r: 1.3, host: bodies[0], dist: bodies[0].r*4 + 3, ph: r()*6.28, w: .06, p: [0, 0, 0]};
  return {idx, arm, heat, sun, bodies, belt, halo, mon, R: orbit};
}
// where everything is at motion time T: planets round the star, moons round their planets
export function place(sys, T){
  const tw = sys.sun.twin; if (tw) { const a = tw.ph + T*tw.w; tw.p = [Math.cos(a)*tw.sep, 0, Math.sin(a)*tw.sep]; }
  for (const b of sys.bodies) {
    if (b.moon) continue;
    const a = b.ph + T*b.w; b.p = [Math.cos(a)*b.orbit, Math.sin(a)*b.orbit*b.inc, Math.sin(a)*b.orbit];
  }
  for (const b of sys.bodies) if (b.moon) {
    const [u, v] = around(b.axis), a = b.ph + T*b.w;
    b.p = add(b.parent.p, add(mul(u, Math.cos(a)*b.dist), mul(v, Math.sin(a)*b.dist)));
  }
  const m = sys.mon, a = m.ph + T*m.w; m.p = add(m.host.p, [Math.cos(a)*m.dist, m.dist*.25, Math.sin(a)*m.dist]);
}
export const STAR_WORDS = {star: 'the star', binary: 'the twin stars', pulsar: 'the pulsar', hole: 'the black hole'};
export const nameOf = (b, sys) => !b ? (sys ? STAR_WORDS[sys.sun.type] : 'the star') : b.kind === 'monument' ? 'the monument' : b.moon ? (b.kind === 'ice' ? 'an icy moon' : 'a small moon')
  : ({rock: b.city ? 'a rocky world lit by cities' : 'a rocky world', gas: b.storm ? (b.ring ? 'a ringed, stormy gas giant' : 'a stormy gas giant') : b.ring ? 'a ringed gas giant' : 'a gas giant',
    ice: b.ring ? 'a ringed ice world' : 'an ice world', lava: 'a lava world', ocean: b.city ? 'an ocean world lit by cities' : 'an ocean world'})[b.kind];
export const starName = sys => ({star: `a ${ARM_WORDS[sys.arm]} star`, binary: 'twin stars', pulsar: 'a pulsar', hole: 'a black hole'})[sys.sun.type];
