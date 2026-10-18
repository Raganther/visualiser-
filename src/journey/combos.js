// Journey: what goes with what. The user asked for smarter, more creative choices; Journey scored each piece on its own
// (the music, its fatigue), so a busy layer over a busy world under a kaleidoscope (the "mush" the user dislikes) was as
// likely as a look made to go together. Here every pair in a cast is weighed: pairs that work (hand-picked, in TUNE.combos.pairs)
// and pairs learned from the user's 👍 and 👎 (the moments' casts: LIKED and DISLIKED in presets.js), and how crowded the
// whole picture would be (each piece's density, against what the music's intensity allows). Read by journey/cast.js and
// journey/extras.js as a bonus to each choice; nothing here draws a random number, so choices stay repeatable.
import { TUNE } from '../tuning.js';
import { LIKED, DISLIKED } from '../presets.js';
import { byKey } from '../visuals/registry.js';
import { planRoom } from './plan.js';
import { genFit } from '../scene/genome.js';

// how much each piece fills the picture (0 sparse .. 1 dense); anything not listed counts as .5
const DENSE = {
  plasma: 1, flow: .9, ribbons: .8, lines: .8, rain: .7, lasers: .7, unfold: .9, fractal: .9, rosette: .8, stargate: .6, burst: .7, horizon: .6,
  guilloche: .7, chords: .6, galaxy: .7, ring: .3, scope: .3, orbit: .35, fireflies: .25, mood: .3, constellation: .3, mandala: .5, comets: .4, vectorscope: .3,
  none: 0, space: .3, aurora: .4, land: .45, dunes: .4, sea: .55, corridor: .4, lattice: .55, city: .75, forest: .7, deep: .7,
  cosmos: .7, hollow: .8, cathedral: .85, geode: .85, vessel: .75, kifs: .9,
};
export const density = k => k == null ? 0 : DENSE[k] ?? .5;
// the pairs learned from the user's moments: +1 for each like holding both, -1 for each dislike (counts, capped below)
let learned = new Map(), seen = '';
const table = {src: null, m: null};
const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const castKeys = p => {   // a moment's look, as the pieces on screen: worlds, layers, objects strongly on, and the kaleidoscope's kind
  const ks = Object.keys(p).filter(k => byKey[k] && typeof p[k] === 'number' && p[k] > .3 && ['world', 'layer', 'object'].includes(byKey[k].kind));
  if ((p.kal || 0) >= 2) ks.push('kal' + Math.round(p.kalMode || 0));
  return ks;
};
function learn(){
  const sig = LIKED.length + ':' + DISLIKED.length + ':' + (LIKED[0] || {}).name + ':' + (DISLIKED[0] || {}).name; if (sig === seen) return; seen = sig;
  learned = new Map();
  for (const [list, s] of [[LIKED, 1], [DISLIKED, -1]]) for (const p of list) {
    const ks = castKeys(p);
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const k = pairKey(ks[i], ks[j]); learned.set(k, (learned.get(k) || 0) + s); }
  }
}
// how well two pieces go together: the hand-picked table, and what the user's moments say
export function pair(a, b){
  if (!a || !b || a === b || a === 'none' || b === 'none') return 0;
  const C = TUNE.combos, k = pairKey(a, b); learn();
  if (table.src !== C.pairs) { table.src = C.pairs; table.m = new Map(Object.entries(C.pairs).map(([p, v]) => [pairKey(...p.split('|')), v])); }   // (written either way round)
  const l = learned.get(k) || 0;
  return (table.m.get(k) || 0) + Math.max(-C.learnCap, Math.min(C.learnCap, l))*C.learned;
}
// a piece against everything already in the cast (pieces: keys; a kaleidoscope as 'kal' + its kind), and against the genome
// while it's on: pieces whose own traits suit it (scene/genome.js)
export const fit = (k, pieces) => pieces.reduce((s, p) => s + pair(k, p), 0) + genFit(k)*TUNE.genome.cast;
// how crowded a cast is, and what that costs: the music's intensity allows more (TUNE.combos.room, calm to intense)
export function crowd(c, T){
  const C = TUNE.combos;
  const d = density(c.world) + density(c.lead) + density(c.accent)*.5 + (c.centre ? C.centreFill : 0) + (c.kal ? C.kalFill + (c.kal.where === 0 ? C.kalAll : 0) : 0);
  const room = C.room[0] + (C.room[1] - C.room[0])*T - planRoom();   // (sparser at a track's opening and close: journey/plan.js)
  return Math.max(0, d - room)*C.crowd;
}
// the cast's pieces as keys, for fit()
export const piecesOf = c => [c.world, c.lead, c.accent, c.centre, c.kal ? 'kal' + (c.kal.mode || 0) : null].filter(k => k && k !== 'none');
