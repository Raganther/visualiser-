// The genome (a leaf module): one section's symmetry, motif, material and colour, which the pieces read while it's on, so they
// are conceived together rather than each choosing its own (the user's question, tested first in tools/genome/genome-lab.html;
// the phone page, src/lab/genome.js, drives it). geo: share the symmetry and motif; col: the material and one family of
// colours; line: each section's genome grown from the last. Read by the Prism (objects/jewel.js: its open forms' wedges, its
// surface), the Lattice (its sides), the Corridor (its frame), the rose window (its wedges), the stargate (its rings), the
// comets (their figures), the fireflies (gathered round the centre), the dance (its turns), the fractal depths, the Hollow
// and the Cathedral (their stuff), the objects' styles and looks, Journey's kaleidoscope (journey/extras.js) and main.js
// (the palette). In Journey (the Adjust panel's Genome switch, kept as afterglow.genome) each section has its own, and a
// returning section brings its own back (genEnter, from journey/sections.js).
// It follows the user's direction: whatever they set by hand (the kaleidoscope's mirrors, kind and fold, an object's style
// or look, a piece pinned with its own traits, the G keys) is written into it and held (GEN.held), so later generations
// keep it while the rest grows on (genSet, genAdopt, genFree); Journey casts towards pieces that suit it (genFit, read by
// journey/combos.js); a liked moment keeps its genome, and new generations now and then take after one (GEN_LIKED).
import { S } from '../state.js';
export const GEN = {on: false, geo: true, col: true, line: true, n: 6, motif: 0, mat: 1, hue: .72, fold: 0, id: 0, held: {}, from: {}};
export const GENES = ['n', 'motif', 'mat', 'hue', 'fold'];
try { const s = JSON.parse(localStorage.getItem('afterglow.genome') || '{}'); for (const k of ['on', 'geo', 'col', 'line']) if (k in s) GEN[k] = !!s[k]; } catch (e) {}
export const genKeep = () => { try { localStorage.setItem('afterglow.genome', JSON.stringify({on: GEN.on, geo: GEN.geo, col: GEN.col, line: GEN.line})); } catch (e) {} };
export const MOTIFS = ['rose', 'pointed arch', 'hexagon', 'star'], MATS = ['stone', 'glass', 'neon', 'metal'];
// what its kaleidoscope folds: everything, the world, the glow, inside the Prism (kalWhere 0-3), or none (4)
export const FOLDS = ['everything folded', 'the world folded', 'the glow folded', 'the Prism folded inside', 'no kaleidoscope'];
import { TUNE } from '../tuning.js';
let seed = 11; const rnd = () => (seed = (seed*16807) % 2147483647)/2147483647;
const pick = a => a[Math.floor(rnd()*a.length)];
const pickW = w => { let r = rnd()*w.reduce((a, b) => a + b, 0); const i = w.findIndex(x => (r -= x) <= 0); return i < 0 ? 0 : i; };
const fresh = () => ({n: 4 + Math.floor(rnd()*7), motif: Math.floor(rnd()*4), mat: Math.floor(rnd()*4), hue: rnd(), fold: pickW(TUNE.genome.fold)});
const keepHeld = g => { for (const k in GEN.held) if (GEN.held[k]) g[k] = GEN[k]; return g; };   // (what the user set stays)
export const randGenome = () => keepHeld(fresh());
// the fold, grown: mostly kept, else a step along everything, the world, the glow, inside the Prism; now and then none, and
// back from none to wherever the weights say (everything the likeliest)
const childFold = f => { const G = TUNE.genome; if (rnd() < (f === 0 ? G.foldKeep0 : G.foldKeep)) return f;   // (everything holds on longest)
  if (f === 4) return pickW(G.fold.slice(0, 4));
  if (rnd() < G.foldNone) return 4; return f === 0 ? 1 : rnd() < G.foldBack || f === 3 ? f - 1 : f + 1; };   // (steps lean back towards everything)
// a section's genome grown from the last: its symmetry a step or a doubling away, mostly the same motif, material and fold,
// the colour moved on a little
export const GEN_LIKED = [];   // the genomes of liked moments (ui/taste.js), which new generations now and then take after
export function child(g){
  if (GEN_LIKED.length && rnd() < TUNE.genome.liked) {   // taking after a liked genome: its symmetry, motif and material, the colour moved on
    const l = pick(GEN_LIKED); return keepHeld({n: l.n, motif: l.motif, mat: l.mat, hue: (g.hue + .07 + rnd()*.1) % 1, fold: l.fold ?? g.fold});
  }
  const opts = [g.n - 1, g.n + 1, g.n*2, g.n % 2 ? g.n + 2 : g.n/2].filter(n => n >= 4 && n <= 12);
  return keepHeld({n: pick(opts.length ? opts : [g.n]), motif: rnd() < .55 ? g.motif : (g.motif + 1) % 4, mat: rnd() < .6 ? g.mat : (g.mat + 1 + Math.floor(rnd()*3)) % 4, hue: (g.hue + .07 + rnd()*.1) % 1, fold: childFold(g.fold ?? 0)});
}
const HIST = [];   // the generations before, for going back (genBack)
const snap = () => ({n: GEN.n, motif: GEN.motif, mat: GEN.mat, hue: GEN.hue, fold: GEN.fold, id: GEN.id});
const remember = () => { HIST.push(snap()); if (HIST.length > 24) HIST.shift(); };
export function nextGenome(){ remember(); Object.assign(GEN, GEN.line ? child(GEN) : randGenome()); GEN.id++; }
let cur = null;   // the section the genome now belongs to (its own is kept on it: t.gen)
const tint = () => { if (GEN.on && GEN.col) S.hueSet = GEN.hue; };   // (the section's colour, from its first frame)
const store = () => { if (cur) cur.gen = snap(); };
// a section entered (journey/sections.js): one seen before brings its own genome back (with what's held now laid over it), a
// new one grows the next generation
export function genEnter(t){ if (!GEN.on || !t) return; cur = t; if (t.gen) { remember(); Object.assign(GEN, keepHeld({...t.gen})); store(); } else { nextGenome(); store(); } tint(); }
// a new generation now, for this section (Nudge, the phone page's Next, the switch turned on)
export function genNew(t){ if (t) cur = t; nextGenome(); store(); tint(); }
// a gene set by the user: written in now and held (later generations keep it) until freed; from: the piece it came with
export function genSet(k, v, from){
  if (!GENES.includes(k) || v == null) return;
  remember(); GEN[k] = k === 'hue' ? ((v % 1) + 1) % 1 : v; GEN.held[k] = true; if (from) GEN.from[k] = from; else delete GEN.from[k];
  store(); if (k === 'hue') tint();
}
export function genFree(k){ if (k == null) { GEN.held = {}; GEN.from = {}; } else { delete GEN.held[k]; delete GEN.from[k]; } }
// back to the generation before (the held genes stay as set)
export function genBack(){ const g = HIST.pop(); if (!g) return false; Object.assign(GEN, keepHeld({...g})); store(); tint(); return true; }
// each piece's own traits: what pinning it tells the genome, and what Journey's casting looks for in it (genFit)
export const TRAITS = {
  dodeca: {n: 5}, geosphere: {n: 5}, knot: {n: 3}, torus: {n: 4}, spikes: {n: 6, motif: 3}, skull: {mat: 0}, coral: {mat: 0},
  jewel: {mat: 1}, prism: {mat: 1}, gems: {mat: 1, n: 5}, bubble: {mat: 1}, growth: {mat: 1, n: 6, motif: 2}, ferro: {mat: 3}, mercury: {mat: 3},
  lattice: {mat: 1, motif: 2}, corridor: {mat: 2}, geode: {mat: 1, motif: 2, n: 6}, cathedral: {mat: 0, motif: 1}, hollow: {mat: 0}, kifs: {n: 4, mat: 0}, city: {mat: 2},
  stargate: {n: 6, motif: 2}, rosette: {mat: 1, motif: 0}, mandala: {n: 6, motif: 0}, unfold: {motif: 0}, fractal: {n: 6}, lasers: {mat: 2}, lines: {mat: 2}, constellation: {motif: 3}, ring: {motif: 0},
};
// a piece pinned by the user: its own traits go into the genome, held while it's pinned (freed with genRelease when it goes)
export function genAdopt(key){
  const t = TRAITS[key]; if (!GEN.on || !t) return false;
  for (const k in t) if ((k === 'mat' ? GEN.col : GEN.geo) && !(GEN.held[k] && !GEN.from[k])) genSet(k, t[k], key);   // (not over a gene set by hand)
  return true;
}
export function genRelease(key){ for (const k in GEN.from) if (GEN.from[k] === key) genFree(k); }
// how well a piece suits the genome now: Journey's casting leans towards it (journey/combos.js; 0 with the genome off)
export function genFit(key){
  const t = TRAITS[key]; if (!GEN.on || !t) return 0;
  let s = 0;
  if (GEN.geo && t.n) s += t.n === GEN.n ? 1 : GEN.n % t.n === 0 || t.n % GEN.n === 0 ? .5 : -.3;
  if (GEN.geo && t.motif != null) s += t.motif === GEN.motif ? .6 : 0;
  if (GEN.col && t.mat != null) s += t.mat === GEN.mat ? 1 : -.3;
  return s;
}
export const genSnap = () => GEN.on ? snap() : null;
// the genome in words, for the panels (a gene the user set marked "held")
const h = k => GEN.held[k] ? ' (held)' : '';
export const genWords = () => !GEN.on ? '' : [GEN.geo ? `${GEN.n}-fold${h('n')}, ${MOTIFS[GEN.motif]}${h('motif')}` : '', GEN.col ? MATS[GEN.mat] + h('mat') : '', GEN.geo ? FOLDS[GEN.fold] + h('fold') : ''].filter(Boolean).join(', ');
// what each piece takes from it (null: the piece's own choice)
export const genN = (lo = 3, hi = 12) => GEN.on && GEN.geo ? Math.max(lo, Math.min(hi, GEN.n)) : null;
export const genMotif = () => GEN.on && GEN.geo ? GEN.motif : null;
export const genMat = () => GEN.on && GEN.col ? GEN.mat : null;
// a piece's own choice from a table by the genome's material, or its own (k: the piece's own)
export const genPick = (table, own) => { const m = genMat(); return m != null ? table[m] : own; };
