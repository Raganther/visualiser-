// The Studio's improviser: parts made on the spot in the song's own format, to start a track from nothing or to play
// along with what the user made. Drums, hats and percussion come out expressive (velocity from where a hit falls in the
// bar, ghost notes, hits left to chance so no two passes are the same, open hats, fills); a bass line listens to the
// drums (it plays round the kick, in the song's key); chords and a hook fit round both. Every part has a style, an energy
// (how busy) and an expression (how far the dynamics swing), and a seed: the same seed makes the same part. vary() makes
// the next variation of a part, for jamming over a loop that never quite repeats.

// a small seeded random (mulberry32): rnd() 0..1, pick(list), chance(p)
export function rng(seed){
  let a = (seed >>> 0) || 1;
  const rnd = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0)/4294967296; };
  rnd.pick = l => l[Math.floor(rnd()*l.length)];
  rnd.chance = p => rnd() < p;
  rnd.weighted = w => { const tot = w.reduce((a, [, x]) => a + x, 0); let r = rnd()*tot; for (const [v, x] of w) if ((r -= x) <= 0) return v; return w[w.length - 1][0]; };
  return rnd;
}

export const STYLES = {
  minimal: {label: 'Minimal', words: 'dry, sparse, every hit placed'},
  driving: {label: 'Driving', words: 'rolling 16ths, a bass between every kick'},
  hypnotic: {label: 'Hypnotic', words: 'loops of odd lengths turning against the bar'},
  broken: {label: 'Broken', words: 'the kick off the grid, syncopated'},
  dub: {label: 'Dub', words: 'half-time weight, long notes, space for the echo'},
  acid: {label: 'Acid', words: '16th basslines that slide and squelch'},
};

/* ---------- the key ---------- */
const MODES = {minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11]};
const PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
// 'D minor', 'F# dorian', 'Bb major' → {root: pitch class, scale: intervals, name}
export function keyOf(key = 'A minor'){
  const m = String(key).trim().match(/^([A-Ga-g])([#b♯♭]?)\s*(\w*)/) || [];
  const pc = ((PC[(m[1] || 'A').toUpperCase()] + (/[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0)) + 12) % 12;
  const mode = MODES[(m[3] || 'minor').toLowerCase()] ? (m[3] || 'minor').toLowerCase() : 'minor';
  return {root: pc, scale: MODES[mode], mode};
}
// the scale degree d (any integer: 7 is the octave) above a root note
const deg = (K, base, d) => base + K.scale[((d % 7) + 7) % 7] + 12*Math.floor(d/7);

/* ---------- dynamics ---------- */
// where a 16th falls in the bar, as weight: the beat strongest, then the off-beat 8th, then the 16ths between
const METRIC = [1, .3, .62, .38], HATM = [.55, .32, 1, .42];
// a velocity as a drum-row digit 1–9: a base, swung by the metre as far as the expression says, a little human wobble
function vel(base, metric, expr, r, spread = .9){
  const v = base + expr*spread*(metric - .55) + expr*.16*(r() - .5);
  return String(Math.max(1, Math.min(9, Math.round(Math.max(.08, Math.min(1, v))*9))));
}
// k hits spread over n steps, turned by rot (a euclidean rhythm)
export function euclid(k, n, rot = 0){ const o = []; for (let i = 0; i < n; i++) o.push(Math.floor((i + rot)*k/n) !== Math.floor((i + rot - 1)*k/n) ? 1 : 0); return o; }
const row = n => Array(n).fill('.');

/* ---------- drums ---------- */
// one part of the kit as a row: what each style plays there, with its dynamics
function kickRow(st, r, e, x, len){
  const s = row(len);
  for (let b = 0; b < len; b += 16) {
    if (st === 'broken') { s[b] = vel(.95, 1, x, r); for (const p of r.chance(.5) ? [6, 10] : [7, 10, 13]) if (b + p < len) s[b + p] = vel(.85, .7, x, r);
      if (e > .5 && r.chance(.6) && b + 3 < len) s[b + 3] = vel(.4, .2, x, r); }
    else if (st === 'dub') { s[b] = vel(.95, 1, x, r); if (b + 8 < len) s[b + 8] = vel(.85, .9, x, r); if (r.chance(.4 + .3*e) && b + 11 < len) s[b + 11] = vel(.45, .3, x, r); }
    else for (let q = 0; q < 16; q += 4) if (b + q < len) s[b + q] = vel(.92, q ? .85 : 1, x*.4, r);
    // (a ghost kick before the bar's end, now and then, in the busier styles)
    if ((st === 'driving' || st === 'acid') && e > .6 && r.chance(.4) && b + 15 < len) s[b + 15] = vel(.35, .2, x, r);
  }
  return s.join('');
}
function backRow(st, r, e, x, len){
  const s = row(len);
  for (let b = 0; b < len; b += 16) {
    const two = st === 'dub' || st === 'broken' ? [8] : st === 'hypnotic' ? (b % 32 ? [12] : []) : st === 'minimal' && e < .4 ? [12] : [4, 12];
    for (const p of two) if (b + p < len) s[b + p] = vel(.85, 1, x*.5, r);
    // ghost snares round the backbeat, more with the expression
    if (st !== 'minimal' && st !== 'hypnotic') for (const p of [7, 9, 14, 15]) if (b + p < len && s[b + p] === '.' && r.chance(.12 + .3*x*e)) s[b + p] = vel(.28, .2, x, r);
  }
  return s.join('');
}
// the hats: each style its own figure; the accents ride the off-beat; ghosts go to chance (`?`) so the loop breathes
function hatRows(st, r, e, x, len){
  const ch = row(len), oh = row(len);
  const L = st === 'hypnotic' ? r.pick([12, 6, 10]) : len;
  for (let i = 0; i < L; i++) {
    const q = i % 4, m = HATM[q];
    let on;
    if (st === 'minimal') on = q === 2 || (e > .45 && r.chance(.25*e) && q !== 0);
    else if (st === 'driving' || st === 'acid') on = q !== 0 || e > .7 || r.chance(.3);
    else if (st === 'hypnotic') on = i % 3 !== 2 || r.chance(.2);
    else if (st === 'broken') on = euclid(e > .5 ? 11 : 9, 16, 1)[i % 16] === 1;
    else on = q === 2 || (q === 3 && r.chance(.35));   // dub: off-beats, a skip after some
    if (!on) continue;
    // (the weakest ghosts play only some of the time, when the expression is high)
    const v = vel(.62, st === 'hypnotic' ? (i % 3 === 0 ? 1 : .35) : m, x, r);
    ch[i] = +v <= 3 && x > .45 && r.chance(.5) ? '?' : v;
  }
  // open hats on the off-beat 8ths: every one in the driving styles, now and then in the others (the closed hat makes way)
  const openP = st === 'driving' || st === 'acid' ? (e > .55 ? .9 : .25) : st === 'dub' ? .5 : st === 'minimal' ? .15*e : .1;
  for (let i = 2; i < len; i += 4) if (r.chance(openP)) { oh[i] = vel(.7, 1, x, r); if (i < L) ch[i] = '.'; }
  return {chh: ch.slice(0, L).join(''), ohh: oh.join('').replace(/\.+$/, '') ? oh.join('') : null};
}
// percussion: euclidean figures round the kick, a polyrhythm length for the hypnotic style
function percRows(st, r, e, x, len, kick){
  const out = {}, k = i => kick[i % kick.length] !== '.';
  const fig = (n, hits, rot, base) => { const p = euclid(hits, n, rot), s = row(n); for (let i = 0; i < n; i++) if (p[i] && !k(i)) s[i] = vel(base, METRIC[i % 4], x, r); return s.join(''); };
  if (st === 'hypnotic') { out.rim = fig(r.pick([5, 7]), 2, r.pick([0, 1, 2]), .5); if (e > .4) out.shaker = fig(7, r.pick([4, 5]), 1, .45); }
  else if (st === 'dub') { out.rim = fig(16, 3, r.pick([1, 2]), .55); if (e > .5) out.shaker = fig(16, 8, 0, .4); }
  else if (st === 'broken') { out.clave = fig(16, r.pick([3, 5]), r.pick([0, 2, 3]), .5); out.rim = fig(16, 2, 5, .45); }
  else { out.rim = fig(16, r.pick([3, 3, 5]), r.pick([1, 2, 3]), .5); if (e > .35) out.shaker = fig(16, e > .7 ? 16 : 8, 0, .38); if (e > .65 && r.chance(.5)) out.clave = fig(16, 3, 6, .45); }
  // (2-bar clips: the second bar the same, the rows going round)
  return out;
}
// a fill in the last beat of a clip: a run of snares (or toms) growing louder
function fillInto(hits, st, r, e, x, len){
  if (e < .35 || st === 'hypnotic') return;
  const key = st === 'dub' ? 'tomL' : r.chance(.5) ? 'snare' : 'clap', s = (hits[key] || '.'.repeat(len)).padEnd(len, '.').split('');
  const from = len - (e > .7 ? 4 : 2);
  for (let i = from; i < len; i++) if (r.chance(.75)) s[i] = vel(.45 + .4*(i - from)/(len - from), .6, x, r, .5);
  hits[key] = s.join('');
}
// a drum clip: the whole kit ('drums'), only the hats ('hats') or only the percussion ('perc'), over `bars`
export function makeDrums({style = 'minimal', energy = .5, expr = .6, seed = 1, part = 'drums', bars = 2, base = null}){
  const r = rng(seed*977 + 13), len = bars*16, hits = base ? {...base} : {};
  if (part === 'drums') { hits.kick = kickRow(style, r, energy, expr, len); const back = backRow(style, r, energy, expr, len); if (back.replace(/\./g, '')) hits[style === 'broken' || style === 'dub' ? 'snare' : 'clap'] = back; }
  if (part === 'drums' || part === 'hats') { const h = hatRows(style, r, energy, expr, len); hits.chh = h.chh; if (h.ohh) hits.ohh = h.ohh; else delete hits.ohh; }
  if (part === 'drums' || part === 'perc') { for (const k of ['rim', 'clave', 'shaker']) delete hits[k]; Object.assign(hits, percRows(style, r, energy, expr, len, hits.kick || 'x...x...x...x...')); }
  if (part === 'drums') fillInto(hits, style, r, energy, expr, len);
  return {bars, hits};
}

/* ---------- listening to the drums ---------- */
// where a drum clip's kick and backbeat fall in each 16-step bar (as sets of steps), and how busy its hats are
export function grooveOf(clip){
  const hits = (clip && clip.hits) || {}, str = k => { const h = hits[k]; return (typeof h === 'string' ? h : h ? h.p : '').replace(/[|\s]/g, ''); };
  const where = k => { const s = str(k), o = new Set(); if (!s) return o; for (let i = 0; i < 16; i++) if (/[^.\-]/.test(s[i % s.length])) o.add(i); return o; };
  const kick = where('kick'), back = new Set([...where('clap'), ...where('snare')]), hat = where('chh');
  return {kick, back, hats: hat.size/16, four: [0, 4, 8, 12].every(i => kick.has(i)) && kick.size <= 5};
}

/* ---------- bass ---------- */
// a bass line round the drums: its rhythm in the gaps the kick leaves (a sidechained bass ducks on the kick anyway), its
// notes mostly the root, with the fifth, the octave, the seventh and the third for movement, and a turn at the end
export function makeBass({style = 'minimal', energy = .5, expr = .6, seed = 1, key = 'A minor', groove = null, bars = 4}){
  const r = rng(seed*631 + 7), K = keyOf(key), g = groove || {kick: new Set([0, 4, 8, 12]), back: new Set(), four: true};
  let root = 24 + K.root; if (root < 26) root += 12;
  const free = i => !g.kick.has(i % 16);
  // its length: a bar, or for the hypnotic style a loop of 12, 10 or 7 steps turning against the bar
  const L = style === 'hypnotic' ? r.pick([12, 10, 7]) : 16;
  let steps;
  if (style === 'driving') steps = [...Array(16).keys()].filter(i => free(i) && (i % 4 !== 3 || r.chance(.4 + .4*energy)) && r.chance(.7 + .3*energy));
  else if (style === 'acid') steps = [...Array(16).keys()].filter(i => r.chance(.55 + .35*energy) && (free(i) || r.chance(.25)));
  else if (style === 'dub') steps = [r.pick([2, 3]), r.pick([10, 11])].filter(free);
  else if (style === 'broken') { const p = euclid(r.pick([5, 6, 7]), 16, r.pick([1, 2, 3])); steps = [...Array(16).keys()].filter(i => p[i] && free(i)); }
  else if (style === 'hypnotic') steps = [...Array(L).keys()].filter(i => (i % 4 !== 0 || !g.four) && r.chance(.35 + .3*energy));
  else steps = [2, 6, 10, 14].filter(i => free(i) && (i % 8 === 2 || r.chance(.4 + .5*energy))).concat(energy > .5 && r.chance(.6) ? [r.pick([7, 15, 11])].filter(free) : []);
  // (a loop needs a few notes to be a riff: at least three, in the gaps)
  for (let t = 0; steps.length < (style === 'dub' ? 1 : 3) && t < 40; t++) { const i = Math.floor(r()*L); if (free(i) && !steps.includes(i)) steps.push(i); }
  steps = [...new Set(steps)].sort((a, b) => a - b);
  // the notes: a motif (degrees), the root most of all
  const DEG = style === 'acid' ? [[0, 5], [7, 2], [3, 1], [4, 1], [6, 1.2], [-1, .6], [2, .6]] : style === 'dub' ? [[0, 6], [4, 1.5], [6, 1], [7, .6]] : [[0, 6], [7, 1.4], [4, 1.1], [6, .8], [2, .7], [3, .4]];
  const motif = steps.map((s, i) => i === 0 ? 0 : r.weighted(DEG));
  const len = style === 'dub' ? 5 : style === 'acid' ? .9 : style === 'driving' ? .45 : .55;
  const notes = [], reps = style === 'hypnotic' ? 1 : bars;
  for (let b = 0; b < reps; b++) steps.forEach((s, i) => {
    let d = motif[i];
    // the last bar turns: its last notes step up or down towards the root again
    if (reps > 1 && b === reps - 1 && i >= steps.length - 2 && r.chance(.6)) d = r.pick([4, 6, 2, -1]);
    if (style === 'acid' && r.chance(.25)) d += 7*r.pick([1, -1]);
    const accent = (s % 4 === 2 ? .9 : s % 2 ? .62 : .75), v = Math.round(Math.max(.25, Math.min(1, accent + expr*.25*(r() - .45)))*100)/100;
    const o = style === 'acid' && r.chance(.3) ? {slide: true} : style !== 'dub' && i === steps.length - 1 && r.chance(.2) ? {slide: true} : null;
    notes.push(o ? [b*16 + s, deg(K, root, d), len, v, o] : [b*16 + s, deg(K, root, d), len, v]);
  });
  return style === 'hypnotic' ? {steps: L, notes} : {bars: reps, notes};
}

/* ---------- chords and a hook ---------- */
// a chord on a scale degree, stacked in thirds: d, d+2, d+4, d+6 (and the ninth), around octave 3
const chordOn = (K, d, n = 4) => { const base = 48 + K.root; return [0, 2, 4, 6, 8].slice(0, n).map(k => deg(K, base, d + k)); };
export function makeChords({style = 'minimal', energy = .5, expr = .6, seed = 1, key = 'A minor', bass = null, bars = 4}){
  const r = rng(seed*389 + 3), K = keyOf(key);
  // the movement: one chord held for the hypnotic and minimal styles, a turn every bar or two for the others
  const prog = style === 'driving' ? r.pick([[0, 5, 6, 0], [0, 3, 5, 6], [0, 6, 5, 6]]) : style === 'dub' ? r.pick([[0, 0, 3, 3], [0, 0, 5, 5]]) : style === 'broken' ? [0, 0, 5, 3] : [0, 0, 0, 0];
  const taken = new Set((bass || []).map(n => Math.floor(n[0]) % 16));
  const notes = [];
  for (let b = 0; b < bars; b++) {
    const ch = chordOn(K, prog[b % 4], style === 'minimal' || style === 'hypnotic' ? 5 : 4);
    if (style === 'hypnotic' && energy < .5) { if (b % 2 === 0) notes.push([b*16, ch, 31, .45]); continue; }
    // stabs in the spaces the bass leaves, on the off-beats first
    const cand = (style === 'dub' ? [2, 10, 6] : [14, 6, 10, 3, 11, 7]).filter(s => !taken.has(s)), n = style === 'dub' ? 1 : 1 + Math.round(energy*1.5);
    for (const s of cand.slice(0, n)) notes.push([b*16 + s, ch, style === 'dub' ? 1.5 : .6, Math.round((.55 + expr*.3*(r() - .3))*100)/100]);
  }
  return {bars, notes: notes.sort((a, b) => a[0] - b[0])};
}
// a hook: a short figure on the scale's strongest notes, in octave 4, its accents rising and falling; for the hypnotic
// style a 5- or 7-step loop that turns against the bar
export function makeHook({style = 'minimal', energy = .5, expr = .6, seed = 1, key = 'A minor', bars = 2}){
  const r = rng(seed*211 + 5), K = keyOf(key), base = 60 + K.root - 12*(K.root > 4);
  const L = style === 'hypnotic' ? r.pick([5, 7]) : bars*16, pool = [-3, -1, 0, 2, 4, 6, 7, 9];
  const n = style === 'hypnotic' ? L : Math.max(3, Math.round((4 + 6*energy)*bars/2));
  const at = style === 'hypnotic' ? [...Array(L).keys()] : [...new Set(Array.from({length: n}, () => r.pick([0, 2, 3, 6, 8, 10, 11, 14]) + 16*Math.floor(r()*bars)))].sort((a, b) => a - b);
  const shape = Math.floor(r()*at.length);
  // (a walk over the scale's strong notes, a step or two at a time, so it sings rather than leaps)
  // (from the middle of its range; a step off either end bounces back in)
  let w = r.pick([2, 3, 4]); const walk = at.map(() => { const d = pool[w]; let nx = w + r.pick([-2, -1, -1, 1, 1, 2]); if (nx < 0 || nx >= pool.length) nx = w - (nx - w); w = Math.max(0, Math.min(pool.length - 1, nx)); return d; });
  const notes = at.map((s, i) => [s, deg(K, base, walk[i]), style === 'hypnotic' ? .8 : r.pick([.5, 1, 1.5]),
    Math.round(Math.max(.3, Math.min(1, .65 + expr*.35*Math.cos((i - shape)/at.length*Math.PI*2) + expr*.1*(r() - .5)))*100)/100]);
  return style === 'hypnotic' ? {steps: L, notes} : {bars, notes};
}

/* ---------- variations ---------- */
// the next variation of a part, from its first take (so it wanders round its idea rather than away from it):
// drums re-roll their ghosts and move a hit or two in the hats and percussion; notes move a note or two to another
// chord tone, or rest one; amount 0..1
export function vary(clip, {seed = 1, amount = .3, key = 'A minor'} = {}){
  const r = rng(seed*7919 + 1), c = JSON.parse(JSON.stringify(clip)), K = keyOf(key);
  if (c.hits) {
    for (const k of Object.keys(c.hits)) {
      if (k === 'kick' || k === 'clap' || k === 'snare') continue;
      const s = (typeof c.hits[k] === 'string' ? c.hits[k] : c.hits[k].p).replace(/[|\s]/g, '').split('');
      for (let i = 0; i < s.length; i++) {
        if (/[1-9]/.test(s[i]) && r.chance(.5)) s[i] = String(Math.max(1, Math.min(9, +s[i] + r.pick([-2, -1, 1, 2]))));
        else if (s[i] === '.' && r.chance(amount*.12)) s[i] = r.pick(['2', '3', '?']);
        else if (/[1-4?]/.test(s[i]) && r.chance(amount*.25)) s[i] = '.';
      }
      if (typeof c.hits[k] === 'string') c.hits[k] = s.join(''); else c.hits[k].p = s.join('');
    }
  }
  if (c.notes) c.notes = c.notes.map(n => {
    if (!r.chance(amount*.35)) return n;
    const m = [...n], p = typeof m[1] === 'number' ? m[1] : null;
    if (p == null) return n;
    // (to a neighbour in the scale, or an octave, or quieter)
    const pc = ((p - K.root) % 12 + 12) % 12, i = K.scale.indexOf(pc);
    if (i >= 0 && r.chance(.6)) { const j = i + r.pick([-1, 1, 2]); m[1] = p - K.scale[i] + K.scale[((j % 7) + 7) % 7] + 12*Math.floor(j/7); }
    else if (r.chance(.5)) m[1] = p + r.pick([12, -12]);
    else m[3] = Math.round((m[3] ?? .8)*.6*100)/100;
    return m;
  });
  return c;
}
